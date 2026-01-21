from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from config import settings


# ============================================
#              ENGINE CONFIGURATION
# ============================================

# Connection pool settings for SQLite async
# StaticPool is recommended for aiosqlite to avoid connection issues
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    # SQLite-specific: use StaticPool for async to prevent threading issues
    poolclass=StaticPool,
    # Connection arguments for better SQLite performance
    connect_args={
        "check_same_thread": False,  # Required for SQLite with async
        "timeout": 30,  # Connection timeout in seconds
    },
)


# ============================================
#              SESSION FACTORY
# ============================================

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================
#              BASE MODEL
# ============================================

class Base(DeclarativeBase):
    """Base class for all models."""

    pass


# ============================================
#              INITIALIZATION
# ============================================

async def init_db() -> None:
    """Initialize database and create all tables."""
    # Ensure data directory exists
    settings.data_dir.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """Dependency for getting database session."""
    async with async_session() as session:
        yield session
