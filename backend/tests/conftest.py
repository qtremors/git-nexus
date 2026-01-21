"""
Pytest Configuration for GitNexus Backend Tests

Provides fixtures for database, FastAPI test client, and mocks.
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import Base
from main import app
from database import get_db


# ============================================
#              EVENT LOOP
# ============================================

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ============================================
#              DATABASE FIXTURES
# ============================================

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""
    async_session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async def override_get_db():
        async with async_session_factory() as session:
            yield session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


# ============================================
#              MOCK FIXTURES
# ============================================

@pytest.fixture
def mock_github_service():
    """Mock GitHub service for API tests."""
    with patch("services.github_service.github_service") as mock:
        # Default mock responses
        mock.fetch_user = AsyncMock(return_value={
            "login": "testuser",
            "name": "Test User",
            "avatar_url": "https://example.com/avatar.png",
            "followers": 100,
            "following": 50,
            "public_repos": 10,
        })
        mock.fetch_user_repos = AsyncMock(return_value=[
            {
                "id": 1,
                "name": "test-repo",
                "full_name": "testuser/test-repo",
                "owner": {"login": "testuser"},
                "description": "A test repo",
                "stargazers_count": 10,
                "forks_count": 5,
            }
        ])
        mock.fetch_latest_release = AsyncMock(return_value={
            "tag_name": "v1.0.0",
            "name": "Release 1.0.0",
            "published_at": "2026-01-01T00:00:00Z",
        })
        mock.fetch_repo_metadata = AsyncMock(return_value={
            "id": 1,
            "name": "test-repo",
            "owner": {"avatar_url": "https://example.com/avatar.png"},
            "html_url": "https://github.com/testuser/test-repo",
            "description": "A test repo",
        })
        mock.parse_github_url = MagicMock(return_value=("testuser", "test-repo"))
        yield mock


@pytest.fixture
def mock_git_service():
    """Mock Git service for replay tests."""
    with patch("services.git_service.git_service") as mock:
        mock.is_valid_repo = MagicMock(return_value=True)
        mock.get_repo_name = MagicMock(return_value="test-repo")
        mock.get_commits = AsyncMock(return_value=[
            {
                "hash": "abc123def456",
                "short_hash": "abc123d",
                "message": "Initial commit",
                "author": "Test User",
                "author_email": "test@example.com",
                "date": "2026-01-01T00:00:00+00:00",
            }
        ])
        mock.clone_repo = AsyncMock(return_value=None)
        mock.get_file_tree = AsyncMock(return_value=[
            {"name": "README.md", "type": "file", "path": "README.md"}
        ])
        yield mock
