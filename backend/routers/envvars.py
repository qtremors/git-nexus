from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.replay import Repository
from services.env_service import env_service

router = APIRouter(prefix="/api/env", tags=["environment"])


# ============================================
#                SCHEMAS
# ============================================


class EnvVarCreate(BaseModel):
    """Single environment variable."""
    key: str
    value: str


class EnvVarBulkUpdate(BaseModel):
    """Bulk update request for environment variables."""
    vars: list[EnvVarCreate]


# ============================================
#            GLOBAL ENV VARS
# ============================================


@router.get("/global")
async def get_global_vars(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Get all global environment variables."""
    return await env_service.get_global_vars(db)


@router.put("/global")
async def set_global_vars(
    data: EnvVarBulkUpdate, db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Set global environment variables (replaces all existing)."""
    vars_list = [{"key": v.key, "value": v.value} for v in data.vars]
    return await env_service.set_vars(db, scope="global", vars=vars_list)


# ============================================
#           PROJECT ENV VARS
# ============================================


@router.get("/project/{repo_id}")
async def get_project_vars(
    repo_id: int, db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Get project-level environment variables for a repository."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )
    return await env_service.get_project_vars(db, repo_id)


@router.put("/project/{repo_id}")
async def set_project_vars(
    repo_id: int, data: EnvVarBulkUpdate, db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Set project-level environment variables (replaces all existing)."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )
    vars_list = [{"key": v.key, "value": v.value} for v in data.vars]
    return await env_service.set_vars(db, scope="project", vars=vars_list, repo_id=repo_id)


# ============================================
#           COMMIT ENV VARS
# ============================================


@router.get("/commit/{repo_id}/{commit_hash}")
async def get_commit_vars(
    repo_id: int, commit_hash: str, db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Get commit-level environment variables."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )
    return await env_service.get_commit_vars(db, repo_id, commit_hash)


@router.put("/commit/{repo_id}/{commit_hash}")
async def set_commit_vars(
    repo_id: int,
    commit_hash: str,
    data: EnvVarBulkUpdate,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Set commit-level environment variables (replaces all existing)."""
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )
    vars_list = [{"key": v.key, "value": v.value} for v in data.vars]
    return await env_service.set_vars(
        db,
        scope="commit",
        vars=vars_list,
        repo_id=repo_id,
        commit_hash=commit_hash,
    )


# ============================================
#         MERGED ENV VARS (READ-ONLY)
# ============================================


@router.get("/merged/{repo_id}/{commit_hash}")
async def get_merged_vars(
    repo_id: int, commit_hash: str, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:

    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )
    return await env_service.get_merged_vars(db, repo_id, commit_hash)
