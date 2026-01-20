"""
GitNexus - Release Cache Service

Handles caching of GitHub release data to minimize API calls.
"""

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.release import CachedRelease

logger = logging.getLogger("gitnexus.release_cache")

# Cache TTL in minutes (1 hour default)
RELEASE_CACHE_TTL_MINUTES = 60


class ReleaseCacheService:
    """Service for caching release data."""

    async def get_cached_releases(
        self, 
        db: AsyncSession, 
        repo_id: int, 
        ttl_minutes: int = RELEASE_CACHE_TTL_MINUTES
    ) -> list[dict] | None:
        """
        Get cached releases for a repository if still valid.
        
        Returns None if cache is stale or doesn't exist.
        """
        query = select(CachedRelease).where(
            CachedRelease.repo_id == repo_id
        ).order_by(CachedRelease.published_at.desc())
        
        result = await db.execute(query)
        releases = result.scalars().all()
        
        if not releases:
            return None
        
        # Check if cache is still valid (use first release's cached_at)
        first_release = releases[0]
        cached_at = first_release.cached_at
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        if (now - cached_at) > timedelta(minutes=ttl_minutes):
            logger.debug(f"Release cache expired for repo {repo_id}")
            return None
        
        # Format for frontend consumption
        return [
            {
                "tag_name": r.tag_name,
                "name": r.name,
                "html_url": r.html_url,
                "published_at": r.published_at.isoformat(),
                "prerelease": r.is_prerelease,
                "assets": r.assets or []
            }
            for r in releases
        ]

    async def get_cached_releases_batch(
        self,
        db: AsyncSession,
        repo_ids: list[int],
        ttl_minutes: int = RELEASE_CACHE_TTL_MINUTES
    ) -> dict[int, list[dict] | None]:
        """
        Get cached releases for multiple repositories in a single query (PERF-2 optimization).
        
        Returns a dict mapping repo_id -> releases (or None if cache is stale/missing).
        """
        if not repo_ids:
            return {}
        
        # Single query for all repos
        query = select(CachedRelease).where(
            CachedRelease.repo_id.in_(repo_ids)
        ).order_by(CachedRelease.repo_id, CachedRelease.published_at.desc())
        
        result = await db.execute(query)
        all_releases = result.scalars().all()
        
        # Group by repo_id
        releases_by_repo: dict[int, list[CachedRelease]] = {}
        for release in all_releases:
            releases_by_repo.setdefault(release.repo_id, []).append(release)
        
        now = datetime.now(timezone.utc)
        output: dict[int, list[dict] | None] = {}
        
        for repo_id in repo_ids:
            releases = releases_by_repo.get(repo_id, [])
            
            if not releases:
                output[repo_id] = None
                continue
            
            # Check if cache is still valid
            cached_at = releases[0].cached_at
            if cached_at.tzinfo is None:
                cached_at = cached_at.replace(tzinfo=timezone.utc)
            
            if (now - cached_at) > timedelta(minutes=ttl_minutes):
                output[repo_id] = None
                continue
            
            # Format for frontend consumption
            output[repo_id] = [
                {
                    "tag_name": r.tag_name,
                    "name": r.name,
                    "html_url": r.html_url,
                    "published_at": r.published_at.isoformat(),
                    "prerelease": r.is_prerelease,
                    "assets": r.assets or []
                }
                for r in releases
            ]
        
        return output

    async def cache_releases(
        self,
        db: AsyncSession,
        repo_id: int,
        releases: list[dict]
    ) -> None:
        """
        Cache release data for a repository.
        
        Clears existing cache and stores new releases.
        """
        # Delete existing cached releases for this repo
        await db.execute(
            delete(CachedRelease).where(CachedRelease.repo_id == repo_id)
        )
        
        now = datetime.now(timezone.utc)
        
        # Insert new releases
        for release in releases:
            published_at_str = release.get("published_at", "")
            try:
                published_at = datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                published_at = now
            
            # Format assets for storage
            raw_assets = release.get("assets", [])
            assets = [
                {
                    "id": a.get("id", 0),
                    "name": a.get("name", ""),
                    "size": a.get("size", 0),
                    "download_url": a.get("browser_download_url", ""),
                    "content_type": a.get("content_type", "")
                }
                for a in raw_assets
            ]
            
            # Add source code archives as pseudo-assets
            tag = release.get("tag_name", "")
            zipball = release.get("zipball_url")
            tarball = release.get("tarball_url")
            
            if zipball:
                assets.append({
                    "id": hash(f"{tag}-zip"),
                    "name": f"Source Code (zip)",
                    "size": 0,
                    "download_url": zipball,
                    "content_type": "application/zip"
                })
            if tarball:
                assets.append({
                    "id": hash(f"{tag}-tar"),
                    "name": f"Source Code (tar.gz)",
                    "size": 0,
                    "download_url": tarball,
                    "content_type": "application/gzip"
                })
            
            cached = CachedRelease(
                repo_id=repo_id,
                tag_name=release.get("tag_name", ""),
                name=release.get("name"),
                html_url=release.get("html_url", ""),
                published_at=published_at,
                is_prerelease=release.get("prerelease", False),
                assets=assets,
                cached_at=now
            )
            db.add(cached)
        
        await db.commit()
        logger.info(f"Cached {len(releases)} releases for repo {repo_id}")

    async def invalidate_cache(self, db: AsyncSession, repo_id: int) -> None:
        """Invalidate (delete) cached releases for a repository."""
        await db.execute(
            delete(CachedRelease).where(CachedRelease.repo_id == repo_id)
        )
        await db.commit()
        logger.debug(f"Invalidated release cache for repo {repo_id}")

    async def invalidate_all(self, db: AsyncSession) -> int:
        """Invalidate all cached releases. Returns count deleted."""
        result = await db.execute(delete(CachedRelease))
        await db.commit()
        count = result.rowcount  # type: ignore
        logger.info(f"Invalidated all release caches ({count} entries)")
        return count


# Singleton
release_cache_service = ReleaseCacheService()
