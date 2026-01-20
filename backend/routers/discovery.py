from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db, async_session
from models.config import AppConfig
from models.github import GitHubCommit
from schemas import (
    CommitCountRequest,
    FetchUserRequest,
    RepoCommitsRequest,
    RepoReadmeRequest,
    DownloadReposRequest,
    ContributionGraphRequest, 
)
from services import cache_service, github_service
from services.token_service import get_token_only
from utils.crypto import crypto_manager
from utils.security import sanitize_filename, is_safe_path
from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import BackgroundTasks

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


@router.post("/fetch-user")
async def fetch_user(
    data: FetchUserRequest,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Fetch a GitHub user's profile and repositories."""
    username = data.username
    token = await get_token_only(db, data.token)

    # Save to search history
    await cache_service.add_to_search_history(db, username)

    # Check cache first (unless refresh requested)
    if not refresh:
        cached_profile = await cache_service.get_cached(db, username, "profile")
        cached_repos = await cache_service.get_cached(db, username, "repos")
        cached_readme = await cache_service.get_cached(db, username, "profile_readme")

        if cached_profile and cached_repos:
            return {
                "profile": cached_profile,
                "repos": cached_repos,
                "profileReadme": cached_readme,
            }

    # Fetch from GitHub
    profile_data = await github_service.fetch_user(username, token, db)

    if isinstance(profile_data, dict) and "error" in profile_data:
        return profile_data

    repos_data = await github_service.fetch_user_repos(username, token, db=db)
    readme_data = await github_service.fetch_readme(username, username, token, db=db)

    if isinstance(readme_data, dict) and "error" in readme_data:
        readme_data = None

    # Cache results
    await cache_service.set_cached(db, username, "profile", profile_data)
    await cache_service.set_cached(db, username, "repos", repos_data)
    if readme_data:
        await cache_service.set_cached(db, username, "profile_readme", readme_data)

    return {
        "profile": profile_data,
        "repos": repos_data,
        "profileReadme": readme_data,
    }


@router.get("/search-history")
async def get_search_history(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Get recent search history."""
    return await cache_service.get_search_history(db)


@router.post("/commit-count")
async def get_commit_count(
    data: CommitCountRequest,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get the total commit count for a repository."""
    cache_key = f"{data.owner}/{data.repo}"
    token = await get_token_only(db, data.token)

    # Check cache
    if not refresh:
        cached = await cache_service.get_cached(db, cache_key, "commit_count_value")
        if cached:
            return cached

    # Fetch from GitHub
    count = await github_service.fetch_commit_count(data.owner, data.repo, token, db=db)
    result = {"count": count}

    # Cache result
    await cache_service.set_cached(db, cache_key, "commit_count_value", result)

    return result


@router.post("/repo-readme")
async def get_repo_readme(
    data: RepoReadmeRequest,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get the README for a repository."""
    cache_key = f"{data.owner}/{data.repo}"
    token = await get_token_only(db, data.token)

    # Check cache
    if not refresh:
        cached = await cache_service.get_cached(db, cache_key, "repo_readme")
        if cached and "error" not in cached:
            return cached

    # Fetch from GitHub
    readme_data = await github_service.fetch_readme(data.owner, data.repo, token, db=db)

    if isinstance(readme_data, dict) and "error" not in readme_data:
        await cache_service.set_cached(db, cache_key, "repo_readme", readme_data)

    return readme_data or {"error": 404}


@router.post("/repo-commits")
async def get_repo_commits(
    data: RepoCommitsRequest,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get recent commits for a repository."""
    cache_key = f"{data.owner}/{data.repo}"
    token = await get_token_only(db, data.token)

    # 1. Check DB first (new cache)
    if not refresh:
        cached_commits = await cache_service.get_repo_commits(db, data.owner, data.repo)
        if cached_commits:
            return cached_commits

    # 2. Fetch from GitHub if missing or refresh requested
    # We use a simplified fetch logic here compared to the bulk sync
    try:
        commits_data = await github_service.fetch_recent_commits(
            data.owner,
            data.repo,
            token,
            limit=1000,
            db=db
        )

        # Save to DB if valid
        if commits_data and isinstance(commits_data, list) and "sha" in commits_data[0]:
             
             for c in commits_data:
                 commit = c.get("commit", {})
                 author = commit.get("author", {})
                 
                 # Upsert
                 await db.merge(GitHubCommit(
                    sha=c["sha"],
                    repo_owner=data.owner,
                    repo_name=data.repo,
                    author_name=author.get("name", "Unknown"),
                    author_date=datetime.fromisoformat(author.get("date").replace("Z", "+00:00")),
                    message=commit.get("message", ""),
                    url=c.get("html_url", "")
                 ))
             await db.commit()
             
             # Return data from DB to ensure format consistency
             return await cache_service.get_repo_commits(db, data.owner, data.repo)
        
        return commits_data
    except Exception as e:
        # Fallback to empty list or error
        return [{"error": str(e)}]


@router.post("/download")
async def download_repos(
    data: DownloadReposRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Download multiple repositories as zip archives."""
    token = await get_token_only(db, data.token)
    
    # Get download path
    result = await db.execute(select(AppConfig).where(AppConfig.key == "download_path"))
    path_config = result.scalar_one_or_none()
    config_path = Path(path_config.value if path_config else Path.cwd() / "downloads")
    base_path = config_path / "repos"

    results = {
        "success": [],
        "failed": [],
        "base_path": str(base_path)
    }

    # Ensure base path exists
    base_path.mkdir(parents=True, exist_ok=True)

    for repo in data.repos:
        try:
            # Construct URL and paths
            # Using zipball URL: https://api.github.com/repos/{owner}/{repo}/zipball
            url = f"{github_service.base_url}/repos/{repo.owner}/{repo.name}/zipball"
            
            safe_name = sanitize_filename(f"{repo.owner}-{repo.name}")
            target_path = base_path / f"{safe_name}.zip"

            # Security check
            if not is_safe_path(base_path, target_path):
                results["failed"].append({"id": repo.id, "error": "Invalid path"})
                continue

            # Download
            success = await github_service.download_asset(url, str(target_path), token, db=db)
            
            if success:
                results["success"].append({"id": repo.id, "path": str(target_path)})
            else:
                results["failed"].append({"id": repo.id, "error": "Download failed"})

        except Exception as e:
            results["failed"].append({"id": repo.id, "error": str(e)})

    return results


@router.post("/contribution-graph")
async def get_contribution_graph(
    data: ContributionGraphRequest,
    background_tasks: BackgroundTasks,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get contribution graph data, syncing if needed."""
    token = await get_token_only(db, data.token)
    username = data.username
    
    # 1. Check if we have synced this user recently
    synced_key = f"commits_synced_{username}"
    # Check cache for sync status
    last_sync = await cache_service.get_cached(db, username, "commits_synced")
    
    # Needs sync if never synced OR refresh requested
    needs_sync = refresh or not last_sync
    
    # 2. Get existing commits from DB
    # Default since: 1 year ago
    since_date = datetime.now(timezone.utc) - timedelta(days=365)
    repo_names = [r.name for r in data.repos]
    
    commits = await cache_service.get_commits_for_graph(db, repo_names, since_date)
    
    # 3. Trigger background sync if needed
    if needs_sync:
        # Helper for background sync task
        async def _sync_contribution_commits(repos_list, token_val, user, since_iso):
            """Background task to sync commits and update cache status."""
            await github_service.fetch_all_commits_for_graph(repos_list, token_val, since_iso)
            async with async_session() as session:
                await cache_service.set_cached(session, user, "commits_synced", {"synced_at": datetime.now(timezone.utc).isoformat()})
        
        if not commits:
            # First time: start sync and return loading state
            background_tasks.add_task(_sync_contribution_commits, data.repos, token, username, since_date.isoformat())
            return {"commits": [], "loading": True}
        elif refresh:
            # Re-sync in background, return existing data
            background_tasks.add_task(_sync_contribution_commits, data.repos, token, username, since_date.isoformat())
            return {"commits": commits, "loading": True}

    return {"commits": commits, "loading": False}


@router.get("/api-status")
async def get_api_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Get GitHub API rate limit status, refreshing if stale."""
    status = await cache_service.get_api_status(db)
    
    # Check if stale (reset time in past or no data)
    now = datetime.now(timezone.utc).timestamp()
    is_stale = not status or (status.get("reset_time", 0) > 0 and status.get("reset_time", 0) < now)
    
    if is_stale:
        # Refresh from GitHub
        # We need a token to check rate limit properly (private limits vs public)
        # Try finding one from env or DB
        token = await get_token_only(db, None)
        await github_service.fetch_rate_limit(token, db)
        # Re-fetch from DB
        status = await cache_service.get_api_status(db)
        
    return status
