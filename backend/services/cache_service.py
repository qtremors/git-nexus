from datetime import datetime, timezone, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.cache import CacheEntry, SearchHistory
from models.github import ApiStatus, GitHubCommit


class CacheService:
    """Service for caching operations."""

    async def get_cached(
        self, db: AsyncSession, username: str, endpoint_type: str, ttl_minutes: int = 60
    ) -> dict | list | None:
        """Get cached data if valid."""
        query = select(CacheEntry).where(
            CacheEntry.username == username,
            CacheEntry.endpoint_type == endpoint_type,
        )
        result = await db.execute(query)
        entry = result.scalar_one_or_none()

        if not entry:
            return None

        # Check expiry
        now = datetime.now(timezone.utc)
        # Ensure last_updated is timezone-aware
        last_updated = entry.last_updated
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
            
        if (now - last_updated) > timedelta(minutes=ttl_minutes):
            return None

        return entry.data

    async def set_cached(
        self, db: AsyncSession, username: str, endpoint_type: str, data: dict | list
    ) -> None:
        """Cache data for a user/endpoint."""
        query = select(CacheEntry).where(
            CacheEntry.username == username,
            CacheEntry.endpoint_type == endpoint_type,
        )
        result = await db.execute(query)
        entry = result.scalar_one_or_none()

        if entry:
            entry.data = data
            entry.last_updated = datetime.now(timezone.utc)
        else:
            entry = CacheEntry(
                username=username,
                endpoint_type=endpoint_type,
                data=data,
                last_updated=datetime.now(timezone.utc),
            )
            db.add(entry)

        await db.commit()

    async def add_to_search_history(self, db: AsyncSession, username: str) -> None:
        """Add a username to search history."""
        query = select(SearchHistory).where(SearchHistory.username == username)
        result = await db.execute(query)
        entry = result.scalar_one_or_none()

        if entry:
            entry.last_searched = datetime.now(timezone.utc)
        else:
            entry = SearchHistory(username=username, last_searched=datetime.now(timezone.utc))
            db.add(entry)

        await db.commit()

    async def get_search_history(self, db: AsyncSession, limit: int = 10) -> list[dict]:
        """Get recent searches."""
        query = (
            select(SearchHistory)
            .order_by(SearchHistory.last_searched.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        entries = result.scalars().all()

        return [
            {
                "username": e.username,
                "last_searched": e.last_searched.isoformat(),
            }
            for e in entries
        ]

    async def get_commits_for_graph(
        self, db: AsyncSession, repo_names: list[str], since: datetime
    ) -> list[dict]:
        """Get flattened commit data for contribution graph."""
        if not repo_names:
            return []

        # Ensure timezone awareness
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        query = (
            select(GitHubCommit)
            .where(GitHubCommit.repo_name.in_(repo_names))
            .where(GitHubCommit.author_date >= since)
        )
        
        result = await db.execute(query)
        commits = result.scalars().all()

        return [
            {
                "sha": c.sha,
                "repo": c.repo_name,
                "date": c.author_date.isoformat(),
                "message": c.message,
                "url": c.url,
            }
            for c in commits
        ]

    async def get_repo_commits(
        self, db: AsyncSession, repo_owner: str, repo_name: str, limit: int = 1000
    ) -> list[dict]:
        """Get commits for a repository in GitHub API format."""
        query = (
            select(GitHubCommit)
            .where(GitHubCommit.repo_owner == repo_owner)
            .where(GitHubCommit.repo_name == repo_name)
            .order_by(GitHubCommit.author_date.desc())
            .limit(limit)
        )
        
        result = await db.execute(query)
        commits = result.scalars().all()

        # Reconstruct GitHub API-like structure for frontend compatibility
        return [
            {
                "sha": c.sha,
                "html_url": c.url,
                "commit": {
                    "message": c.message,
                    "author": {
                        "name": c.author_name,
                        "date": c.author_date.isoformat(),
                    },
                },
                "author": {
                    "login": "unknown", # We don't store author login yet
                    "avatar_url": "",   # We don't store avatar yet
                }
            }
            for c in commits
        ]

    async def get_api_status(self, db: AsyncSession) -> dict:
        """Get current API rate limit status."""
        query = select(ApiStatus).limit(1)
        result = await db.execute(query)
        status = result.scalar_one_or_none()

        if not status:
            return {"limit": 5000, "remaining": 5000, "reset_time": 0, "token_source": "none"}
            
        return {
            "limit": status.limit,
            "remaining": status.remaining,
            "reset_time": status.reset_time,
            "token_source": status.token_source or "none",
            "last_updated": status.last_updated.isoformat() if status.last_updated else None
        }

    async def cleanup_expired_cache(
        self, db: AsyncSession, ttl_minutes: int = 60
    ) -> int:
        """Delete expired cache entries. Returns count of deleted entries."""
        from sqlalchemy import delete
        
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=ttl_minutes)
        
        result = await db.execute(
            delete(CacheEntry).where(CacheEntry.last_updated < cutoff)
        )
        await db.commit()
        
        return result.rowcount


# Singleton
cache_service = CacheService()

