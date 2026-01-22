from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.replay import Commit, Repository
from services.env_service import env_service
from services.git_service import git_service
from services.server_service import server_orchestrator
from services.workspace_service import workspace_service

router = APIRouter(prefix="/api/replay", tags=["replay"])


# ============================================
#                SCHEMAS
# ============================================


class RepoCreate(BaseModel):
    """Request to add a local repository."""
    path: str


class RepoClone(BaseModel):
    """Request to clone a remote repository."""
    url: str
    dest: str


class RepoResponse(BaseModel):
    """Repository response model."""
    id: int
    name: str
    path: str
    is_remote: bool
    remote_url: str | None

    class Config:
        from_attributes = True


class StartServerRequest(BaseModel):
    """Request to start a commit server."""
    repo_id: int
    commit_hash: str = Field(..., pattern=r'^[a-f0-9]{7,40}$', description="Git commit hash (7-40 hex chars)")
    port: int | None = Field(None, ge=1024, le=65535, description="Preferred port (1024-65535)")


class PaginatedCommitsResponse(BaseModel):
    """Paginated commits response."""
    commits: list[dict]
    total: int
    page: int
    page_size: int
    has_more: bool


class CommitResponse(BaseModel):
    """Single commit response with number."""
    hash: str
    short_hash: str
    message: str
    author: str
    author_email: str
    date: str
    commit_number: int

    class Config:
        from_attributes = True


class ServerStopResponse(BaseModel):
    """Response for stop server operation."""
    id: str
    stopped: bool
    message: str


# ============================================
#              REPOSITORIES
# ============================================


@router.get("/repos", response_model=list[RepoResponse])
async def list_repos(db: AsyncSession = Depends(get_db)) -> list[RepoResponse]:
    """List all loaded repositories."""
    result = await db.execute(select(Repository))
    repos = result.scalars().all()
    return [RepoResponse.model_validate(r) for r in repos]


@router.post("/repos/local", response_model=RepoResponse, status_code=status.HTTP_201_CREATED)
async def add_local_repo(
    data: RepoCreate, db: AsyncSession = Depends(get_db)
) -> RepoResponse:
    """Add a local Git repository."""
    path = Path(data.path)

    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path does not exist: {data.path}",
        )

    if not git_service.is_valid_repo(data.path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not a valid Git repository: {data.path}",
        )

    result = await db.execute(
        select(Repository).where(Repository.path == str(path.resolve()))
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository already loaded: {data.path}",
        )

    repo = Repository(
        name=git_service.get_repo_name(data.path),
        path=str(path.resolve()),
        is_remote=False,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Sync commits from git to database
    await sync_repo_commits(db, repo)

    return RepoResponse.model_validate(repo)


@router.post("/repos/clone", response_model=RepoResponse, status_code=status.HTTP_201_CREATED)
async def clone_remote_repo(
    data: RepoClone, db: AsyncSession = Depends(get_db)
) -> RepoResponse:
    """Clone a remote Git repository."""
    dest = Path(data.dest)

    if dest.exists() and any(dest.iterdir()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Destination is not empty: {data.dest}",
        )

    try:
        await git_service.clone_repo(data.url, data.dest)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clone repository: {str(e)}",
        )

    repo = Repository(
        name=git_service.get_repo_name(data.dest),
        path=str(dest.resolve()),
        is_remote=True,
        remote_url=data.url,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Sync commits from git to database
    await sync_repo_commits(db, repo)

    return RepoResponse.model_validate(repo)


@router.get("/repos/{repo_id}", response_model=RepoResponse)
async def get_repo(
    repo_id: int, db: AsyncSession = Depends(get_db)
) -> RepoResponse:
    """Get a repository by ID."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    return RepoResponse.model_validate(repo)


@router.delete("/repos/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repo(repo_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Remove a repository from the list (does not delete files)."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    await db.delete(repo)
    await db.commit()


# ============================================
#              COMMITS (WITH PAGINATION)
# ============================================


@router.get("/repos/{repo_id}/commits", response_model=PaginatedCommitsResponse)
async def get_commits(
    repo_id: int,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedCommitsResponse:
    """Get commits for a repository with pagination from database."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    # Get total count
    total_result = await db.execute(
        select(func.count(Commit.id)).where(Commit.repo_id == repo_id)
    )
    total = total_result.scalar() or 0

    # Get paginated commits (ordered by commit_number descending - newest first)
    skip = (page - 1) * page_size
    commits_result = await db.execute(
        select(Commit)
        .where(Commit.repo_id == repo_id)
        .order_by(Commit.commit_number.desc())
        .offset(skip)
        .limit(page_size)
    )
    commits = commits_result.scalars().all()

    has_more = skip + len(commits) < total

    return PaginatedCommitsResponse(
        commits=[
            {
                "hash": c.hash,
                "short_hash": c.short_hash,
                "message": c.message,
                "author": c.author,
                "author_email": c.author_email,
                "date": c.date.isoformat(),
                "commit_number": c.commit_number,
            }
            for c in commits
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more,
    )


async def sync_repo_commits(db: AsyncSession, repo: Repository) -> None:
    """Sync all commits from git to database with sequential numbering (batch optimized)."""
    # No artificial limit - fetch all commits from git history
    git_commits = await git_service.get_commits(repo.path)
    
    # Commits come in reverse chronological order (newest first)
    git_commits.reverse()
    
    # Process in chunks to avoid memory issues
    CHUNK_SIZE = 500
    for chunk_start in range(0, len(git_commits), CHUNK_SIZE):
        chunk = git_commits[chunk_start:chunk_start + CHUNK_SIZE]
        commit_objects = [
            Commit(
                repo_id=repo.id,
                hash=gc["hash"],
                short_hash=gc["short_hash"],
                message=gc["message"],
                author=gc["author"],
                author_email=gc["author_email"],
                date=datetime.fromisoformat(gc["date"]),
                commit_number=chunk_start + i + 1,
            )
            for i, gc in enumerate(chunk)
        ]
        db.add_all(commit_objects)
        await db.flush()  # Flush each chunk to free memory
    
    await db.commit()


@router.post("/repos/{repo_id}/sync-commits")
async def resync_commits(
    repo_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Re-sync commits from git to database (useful after git pull)."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    # Delete existing commits
    await db.execute(
        Commit.__table__.delete().where(Commit.repo_id == repo_id)
    )
    
    # Re-sync
    await sync_repo_commits(db, repo)
    
    # Get new count
    total_result = await db.execute(
        select(func.count(Commit.id)).where(Commit.repo_id == repo_id)
    )
    total = total_result.scalar() or 0
    
    return {"synced": total, "message": f"Synced {total} commits"}


# ============================================
#              FILE TREE
# ============================================


@router.get("/repos/{repo_id}/files")
async def get_file_tree(
    repo_id: int,
    commit: str = Query("HEAD", description="Commit hash"),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get the file tree for a repository at a specific commit."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    try:
        return await git_service.get_file_tree(repo.path, commit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file tree: {str(e)}",
        )


@router.get("/repos/{repo_id}/file-content")
async def get_file_content(
    repo_id: int,
    path: str = Query(..., description="File path within the repository"),
    commit: str = Query("HEAD", description="Commit hash"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get the content of a specific file at a commit."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

    try:
        content = await git_service.get_file_content(repo.path, commit, path)
        return {"content": content, "path": path, "commit": commit}
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}",
        )


# ============================================
#                SERVERS
# ============================================


@router.get("/servers")
async def list_servers() -> list[dict]:
    """List all server instances (running and stopped)."""
    servers = server_orchestrator.get_all_servers()
    return [server_orchestrator.to_response(s) for s in servers]


@router.get("/servers/running")
async def list_running_servers() -> list[dict]:
    """List only running servers."""
    servers = server_orchestrator.get_running_servers()
    return [server_orchestrator.to_response(s) for s in servers]


@router.post("/servers", status_code=status.HTTP_201_CREATED)
async def start_server(
    data: StartServerRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start a server for a specific commit."""
    result = await db.execute(select(Repository).where(Repository.id == data.repo_id))
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {data.repo_id}",
        )

    # Create workspace using workspace_service
    try:
        workspace_path = await workspace_service.create_workspace(
            repo_path=repo.path,
            repo_name=repo.name,
            commit_hash=data.commit_hash,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workspace: {str(e)}",
        )

    # Get merged environment variables
    env = await env_service.get_merged_vars(db, repo.id, data.commit_hash)

    # Start server
    instance = await server_orchestrator.start_server(
        repo_id=repo.id,
        repo_name=repo.name,
        repo_path=repo.path,
        commit_hash=data.commit_hash,
        workspace_path=workspace_path,
        env=env,
        preferred_port=data.port,
    )

    response = server_orchestrator.to_response(instance)

    if instance.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=response.get("error", "Failed to start server"),
        )

    return response


@router.get("/servers/{server_id}")
async def get_server(server_id: str) -> dict:
    """Get server status by ID."""
    instance = server_orchestrator.get_server(server_id)

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server not found: {server_id}",
        )

    return server_orchestrator.to_response(instance)


@router.post("/servers/{server_id}/stop", response_model=ServerStopResponse)
async def stop_server(server_id: str) -> ServerStopResponse:
    """Stop a running server."""
    instance = server_orchestrator.get_server(server_id)

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server not found: {server_id}",
        )

    stopped = await server_orchestrator.stop_server(server_id)

    return ServerStopResponse(
        id=server_id,
        stopped=stopped,
        message="Server stopped" if stopped else "Server was not running",
    )


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_server(server_id: str) -> None:
    """Remove a stopped server from tracking."""
    instance = server_orchestrator.get_server(server_id)

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server not found: {server_id}",
        )

    if instance.status == "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove a running server. Stop it first.",
        )

    server_orchestrator.remove_server(server_id)


@router.post("/servers/stop-all")
async def stop_all_servers() -> dict:
    """Stop all running servers."""
    count = await server_orchestrator.stop_all()
    return {"stopped": count, "message": f"Stopped {count} servers"}
