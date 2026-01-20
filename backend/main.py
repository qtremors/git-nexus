from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db, async_session
from utils.logger import setup_logging, log_worker, get_db_logs, cleanup_old_logs
from services.cache_service import cache_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    setup_logging()
    await init_db()
    settings.workspaces_dir.mkdir(parents=True, exist_ok=True)
    
    # Cleanup stale data on startup
    logger = logging.getLogger("gitnexus")
    try:
        async with async_session() as session:
            deleted_cache = await cache_service.cleanup_expired_cache(session)
            if deleted_cache > 0:
                logger.info(f"Cleaned up {deleted_cache} expired cache entries")
        
        deleted_logs = await cleanup_old_logs(retention_days=7)
        if deleted_logs > 0:
            logger.info(f"Cleaned up {deleted_logs} old log entries (>7 days)")
    except Exception as e:
        logger.warning(f"Startup cleanup failed: {e}")
    
    # Start log worker
    import asyncio
    log_task = asyncio.create_task(log_worker())
    
    yield
    
    # Shutdown - cleanup resources
    log_task.cancel()
    try:
        await log_task
    except asyncio.CancelledError:
        pass
    
    # Close GitHub HTTP client (ARCH-7 fix)
    from services.github_service import github_service
    await github_service.close()
    
    # Stop all running servers
    from services.server_service import server_orchestrator
    await server_orchestrator.stop_all()


app = FastAPI(
    title=settings.app_name,
    description="Your GitHub Command Center - User Discovery, Asset Watchtower, Repo Replay",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/api/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "version": settings.app_version}

@app.get("/api/logs")
async def get_logs(limit: int = 100) -> list[dict]:
    """Get recent system logs."""
    return await get_db_logs(limit)

# Register routers
from routers import (
    discovery_router,
    envvars_router,
    replay_router,
    settings_router,
    watchlist_router,
)

app.include_router(discovery_router)
app.include_router(watchlist_router)
app.include_router(settings_router)
app.include_router(replay_router)
app.include_router(envvars_router)



