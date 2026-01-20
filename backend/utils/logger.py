"""
GitNexus - Logging Utility

Provides DB-backed logging with colored console output.
"""

import asyncio
import logging
import sys
from collections import deque
from datetime import datetime, timezone
from queue import SimpleQueue
from typing import List

from pydantic import BaseModel

from models.log import Log
from database import async_session


# --- Models ---

class LogSchema(BaseModel):
    """Schema for a log entry."""
    id: str
    timestamp: datetime
    level: str
    message: str
    module: str


# --- Handler ---

class DBQueueHandler(logging.Handler):
    """Pushes logs to a queue for async DB insertion."""
    def __init__(self):
        super().__init__()
        self.queue = SimpleQueue()

    def emit(self, record: logging.LogRecord):
        try:
            entry = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc),
                "level": record.levelname,
                "module": record.name,
                "message": record.getMessage(),
            }
            self.queue.put(entry)
        except Exception:
            self.handleError(record)


# --- Global Instance ---
db_handler = DBQueueHandler()

async def log_worker():
    """Background task to consume logs and save to DB."""
    while True:
        try:
            # Collect a batch
            batch = []
            
            while not db_handler.queue.empty():
                try:
                    batch.append(db_handler.queue.get_nowait())
                    if len(batch) >= 100: # Max batch size
                        break
                except Exception:
                    break
            
            if batch:
                async with async_session() as session:
                    async with session.begin():
                        session.add_all([
                            Log(
                                timestamp=item["timestamp"],
                                level=item["level"],
                                module=item["module"],
                                message=item["message"]
                            ) for item in batch
                        ])
            
            # Wait a bit before next check to allow batching
            await asyncio.sleep(0.5)
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            # Last resort print
            print(f"Log worker failed: {e}")
            await asyncio.sleep(1)

async def get_db_logs(limit: int = 100) -> List[dict]:
    """Retrieve logs from DB."""
    from sqlalchemy import select
    async with async_session() as session:
        result = await session.execute(
            select(Log).order_by(Log.timestamp.desc()).limit(limit)
        )
        logs = result.scalars().all()
        return [
            {
                "id": str(log.id),
                "timestamp": log.timestamp,
                "level": log.level,
                "message": log.message,
                "module": log.module
            }
            for log in logs
        ] # Returns newest first due to order_by desc


async def cleanup_old_logs(retention_days: int = 7) -> int:
    """Delete logs older than retention period. Returns count of deleted entries."""
    from sqlalchemy import delete
    from datetime import timedelta
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    async with async_session() as session:
        result = await session.execute(
            delete(Log).where(Log.timestamp < cutoff)
        )
        await session.commit()
        return result.rowcount


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for terminal output."""
    
    # ANSI Color Codes
    GREY = "\x1b[38;20m"
    BLUE = "\x1b[34;20m"
    GREEN = "\x1b[32;20m"
    YELLOW = "\x1b[33;20m"
    RED = "\x1b[31;20m"
    BOLD_RED = "\x1b[31;1m"
    RESET = "\x1b[0m"
    CYAN = "\x1b[36;20m"

    FORMATS = {
        logging.DEBUG: GREY + "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s" + RESET,
        logging.INFO: GREEN + "%(asctime)s | %(levelname)-8s" + RESET + " | " + CYAN + "%(name)s" + RESET + " | %(message)s",
        logging.WARNING: YELLOW + "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s" + RESET,
        logging.ERROR: RED + "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s" + RESET,
        logging.CRITICAL: BOLD_RED + "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s" + RESET,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno, self.FORMATS[logging.DEBUG])
        formatter = logging.Formatter(log_fmt, datefmt="%H:%M:%S")
        return formatter.format(record)

# --- Global Instance ---
# db_handler is defined above


def setup_logging():
    """Configure application logging."""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColoredFormatter())
    logger.addHandler(console_handler)
    
    # DB Handler
    logger.addHandler(db_handler)
    
    # Quiet down some noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)

    # Log startup
    logging.getLogger("gitnexus").info("Logging initialized 🚀")
