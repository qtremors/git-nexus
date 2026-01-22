import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from constants import RepoStatus
from database import get_db, async_session
from models.config import AppConfig
from config import settings
from models.watchlist import TrackedRepo
from schemas import (
    AddByUrlRequest,
    CheckUpdatesRequest,
    RemoveRepoRequest,
    TrackedRepoResponse,
    WatchlistDetailsRequest,
    ReorderWatchlistRequest,
)
from services import github_service
from services.token_service import get_token_only
from services.release_cache_service import release_cache_service

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("", response_model=list[TrackedRepoResponse])
async def get_watchlist(db: AsyncSession = Depends(get_db)) -> list[TrackedRepoResponse]:
    """Get all tracked repositories with cached releases (PERF-2 optimized with batch query)."""
    result = await db.execute(
        select(TrackedRepo).order_by(TrackedRepo.sort_order.asc(), TrackedRepo.id.desc())
    )
    repos = result.scalars().all()
    
    # PERF-2: Batch query for all releases in single DB call
    repo_ids = [r.id for r in repos]
    cached_releases_map = await release_cache_service.get_cached_releases_batch(db, repo_ids)
    
    # Build response with cached releases included
    response = [
        TrackedRepoResponse(
            id=r.id,
            owner=r.owner,
            name=r.repo_name,
            current_version=r.current_version,
            latest_version=r.latest_version,
            description=r.description,
            avatar_url=r.avatar_url,
            html_url=r.html_url,
            sort_order=r.sort_order,
            releases=cached_releases_map.get(r.id),
        )
        for r in repos
    ]
    
    return response


@router.post("/reorder")
async def reorder_watchlist(
    data: ReorderWatchlistRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update the sort order of watchlist items."""
    # Fetch all repos involved (or just all)
    result = await db.execute(select(TrackedRepo).where(TrackedRepo.id.in_(data.ids)))
    repos = result.scalars().all()
    repo_map = {r.id: r for r in repos}

    for index, repo_id in enumerate(data.ids):
        if repo_id in repo_map:
            repo_map[repo_id].sort_order = index

    await db.commit()
    return {"message": "Order updated"}


@router.post("/add-by-url", status_code=status.HTTP_201_CREATED)
async def add_by_url(
    data: AddByUrlRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a repository to the watchlist by GitHub URL."""
    owner, name = github_service.parse_github_url(data.url)
    if not owner or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub URL",
        )

    # Check if already exists
    result = await db.execute(
        select(TrackedRepo).where(
            TrackedRepo.owner == owner,
            TrackedRepo.repo_name == name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository is already in your watchlist",
        )

    # Fetch metadata
    token = await get_token_only(db, data.token)
    meta = await github_service.fetch_repo_metadata(owner, name, token, db=db)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found or private",
        )

    # Create entry
    new_repo = TrackedRepo(
        owner=owner,
        repo_name=name,
        description=meta.get("description"),
        avatar_url=meta["owner"]["avatar_url"],
        html_url=meta["html_url"],
        current_version=RepoStatus.NOT_CHECKED,
    )
    db.add(new_repo)
    await db.commit()

    return {"message": f"Added {name} to watchlist"}


@router.post("/remove")
async def remove_repo(
    data: RemoveRepoRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove a repository from the watchlist."""
    result = await db.execute(select(TrackedRepo).where(TrackedRepo.id == data.id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found",
        )

    await db.delete(repo)
    await db.commit()
    return {"message": "Removed"}


@router.post("/check-updates")
async def check_updates(
    data: CheckUpdatesRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check all tracked repositories for updates (Parallel)."""
    import asyncio
    
    token = await get_token_only(db, data.token)
    result = await db.execute(select(TrackedRepo))
    repos = result.scalars().all()
    
    concurrency_limit = asyncio.Semaphore(5)

    async def _check_repo_update(repo_id: int, owner: str, repo_name: str, current_version: str, latest_version: str | None) -> dict:
        """Fetch update info without mutating ORM. Returns update data."""
        async with concurrency_limit:
            # Create a dedicated session for the API tracking to avoid concurrency issues
            async with async_session() as api_session:
                release_data = await github_service.fetch_latest_release(
                    owner, repo_name, token, db=api_session
                )
        
        if release_data:
            tag_name = release_data.get("tag_name", RepoStatus.UNKNOWN)
            return {
                "repo_id": repo_id,
                "new_latest": tag_name,
                "updated": latest_version != tag_name,
                "set_current": current_version == RepoStatus.NOT_CHECKED,
            }
        return {"repo_id": repo_id, "updated": False}

    # Run checks in parallel - tasks return data, don't mutate ORM
    tasks = [
        _check_repo_update(r.id, r.owner, r.repo_name, r.current_version, r.latest_version)
        for r in repos
    ]
    results = await asyncio.gather(*tasks)
    
    # Apply mutations sequentially after all async work is done
    updates_found = 0
    repo_map = {r.id: r for r in repos}
    for update_info in results:
        repo = repo_map.get(update_info["repo_id"])
        if repo and update_info.get("new_latest"):
            if update_info.get("updated"):
                repo.latest_version = update_info["new_latest"]
                updates_found += 1
            if update_info.get("set_current"):
                repo.current_version = update_info["new_latest"]
            repo.last_checked = datetime.now(timezone.utc)
    
    await db.commit()
    return {"updates_found": updates_found, "message": "Check complete"}


@router.post("/details")
async def get_watchlist_details(
    data: WatchlistDetailsRequest,
    refresh: bool = Query(False, description="Force refresh from GitHub API"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Get release details for a tracked repository.
    
    Uses cached data when available. Pass refresh=true to force API fetch.
    """
    # Find repo_id for caching
    result = await db.execute(
        select(TrackedRepo).where(
            TrackedRepo.owner == data.owner,
            TrackedRepo.repo_name == data.repo
        )
    )
    repo = result.scalar_one_or_none()
    repo_id = repo.id if repo else None
    
    # Try cache first (unless refresh requested)
    if repo_id and not refresh:
        cached = await release_cache_service.get_cached_releases(db, repo_id)
        if cached:
            return cached
    
    # Fetch from GitHub
    token = await get_token_only(db, data.token)
    releases = await github_service.fetch_releases(data.owner, data.repo, token, limit=data.limit, db=db)

    # Format for response
    formatted = []
    for r in releases:
        assets = []
        raw_assets = r.get("assets", [])
        
        for a in raw_assets:
            assets.append({
                "id": a.get("id", 0),
                "name": a.get("name", "Unknown"),
                "size": a.get("size", 0),
                "download_url": a.get("browser_download_url", ""),
                "updated_at": a.get("updated_at", ""),
            })
            
        # Add Source Code Archives
        if r.get("zipball_url"):
            assets.append({
                "id": hash(f"{r.get('tag_name')}-zip"),
                "name": f"Source Code (zip)",
                "size": 0,
                "download_url": r.get("zipball_url"),
                "updated_at": r.get("published_at", ""),
            })
        if r.get("tarball_url"):
            assets.append({
                "id": hash(f"{r.get('tag_name')}-tar"),
                "name": f"Source Code (tar.gz)",
                "size": 0,
                "download_url": r.get("tarball_url"),
                "updated_at": r.get("published_at", ""),
            })

        formatted.append({
            "tag_name": r.get("tag_name", "Unknown"),
            "name": r.get("name", "Unknown"),
            "published_at": r.get("published_at", ""),
            "html_url": r.get("html_url", ""),
            "prerelease": r.get("prerelease", False),
            "assets": assets,
        })

    # Cache the results
    if repo_id and releases:
        await release_cache_service.cache_releases(db, repo_id, releases)

    return formatted


@router.get("/export")
async def export_watchlist(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
) -> FileResponse:
    """Export watchlist as JSON file."""
    result = await db.execute(select(TrackedRepo))
    repos = result.scalars().all()

    export_data = []
    for r in repos:
        export_data.append({
            "owner": r.owner,
            "name": r.repo_name,
            "description": r.description,
            "avatar_url": r.avatar_url,
            "html_url": r.html_url,
            "current_version": r.current_version,
        })

    # Create temp file
    fd, path = tempfile.mkstemp(suffix=".json")
    with open(fd, "w") as f:
        json.dump(export_data, f, indent=4)

    # Schedule cleanup
    background_tasks.add_task(Path(path).unlink, missing_ok=True)

    filename = f"gitnexus_backup_{datetime.now().strftime('%Y%m%d')}.json"
    return FileResponse(
        path,
        media_type="application/json",
        filename=filename,
    )


@router.post("/import")
async def import_watchlist(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Import watchlist from JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON: {str(e)}",
        )

    added_count = 0
    for item in data:
        owner = item.get("owner")
        name = item.get("name")

        if not owner or not name:
            continue

        # Check if exists
        result = await db.execute(
            select(TrackedRepo).where(
                TrackedRepo.owner == owner,
                TrackedRepo.repo_name == name,
            )
        )
        if result.scalar_one_or_none():
            continue

        new_repo = TrackedRepo(
            owner=owner,
            repo_name=name,
            description=item.get("description"),
            avatar_url=item.get("avatar_url"),
            html_url=item.get("html_url"),
            current_version=item.get("current_version", RepoStatus.NOT_CHECKED),
        )
        db.add(new_repo)
        added_count += 1

    await db.commit()
    return {
        "message": f"Successfully imported {added_count} repositories.",
        "success": True,
    }
