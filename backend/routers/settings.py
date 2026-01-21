from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.config import AppConfig
from schemas import (
    DownloadAssetRequest,
    PathRequest,
    TokenRequest,
    ThemeRequest,
    LastRepoRequest,
)
from services import github_service
from services.token_service import get_token_only
from services.release_cache_service import release_cache_service
from utils.crypto import crypto_manager
from utils.security import sanitize_filename, validate_download_path, is_safe_path, validate_download_url

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ============================================
#              TOKEN MANAGEMENT
# ============================================


@router.get("/token")
async def get_saved_token(db: AsyncSession = Depends(get_db)) -> dict:
    """Get the saved GitHub token (decrypted), including source."""
    # Check .env first
    if settings.github_token:
        # If env var is set, it overrides DB, so we report that.
        # We don't verify if it's valid here, just that it's being used.
        return {
            "token": "********************", # Masked
            "source": "env",
            "isActive": True
        }

    result = await db.execute(select(AppConfig).where(AppConfig.key == "github_token"))
    config = result.scalar_one_or_none()
    
    if not config or not config.value:
        return {"token": "", "source": "none", "isActive": False}
        
    try:
        decrypted_token = crypto_manager.decrypt(config.value)
        # Return masked value for security - only show last 4 chars
        if len(decrypted_token) > 4:
            masked = "*" * (len(decrypted_token) - 4) + decrypted_token[-4:]
        else:
            masked = "*" * len(decrypted_token)
        return {
            "token": masked,
            "source": "db",
            "isActive": True
        }
    except Exception:
        # If decryption fails, return empty so user can re-enter
        return {"token": "", "source": "none", "isActive": False}


@router.post("/token")
async def save_token(
    data: TokenRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save the GitHub token (encrypted)."""
    encrypted_token = crypto_manager.encrypt(data.token.strip())
    
    result = await db.execute(select(AppConfig).where(AppConfig.key == "github_token"))
    config = result.scalar_one_or_none()

    if config:
        config.value = encrypted_token
    else:
        config = AppConfig(key="github_token", value=encrypted_token)
        db.add(config)

    await db.commit()
    return {"status": "saved"}


# ============================================
#            DOWNLOAD PATH
# ============================================


@router.get("/download-path")
async def get_download_path(db: AsyncSession = Depends(get_db)) -> dict:
    """Get the configured download path."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == "download_path"))
    config = result.scalar_one_or_none()
    default_path = str(Path.cwd() / "downloads")
    return {"path": config.value if config else default_path}


@router.post("/download-path")
async def save_download_path(
    data: PathRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save the download path."""
    try:
        # Validate path (checks against sensitive paths and root)
        path = validate_download_path(data.path.strip())
        
        # Ensure it exists or can be created
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path or permission denied",
        )

    result = await db.execute(select(AppConfig).where(AppConfig.key == "download_path"))
    config = result.scalar_one_or_none()

    if config:
        config.value = str(path)
    else:
        config = AppConfig(key="download_path", value=str(path))
        db.add(config)

    await db.commit()
    return {"status": "saved"}


# ============================================
#            THEME & STATE
# ============================================


@router.get("/theme")
async def get_theme(db: AsyncSession = Depends(get_db)) -> dict:
    """Get the saved theme."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == "theme"))
    config = result.scalar_one_or_none()
    return {"theme": config.value if config else "default"}


@router.post("/theme")
async def save_theme(
    data: ThemeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save the theme."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == "theme"))
    config = result.scalar_one_or_none()

    if config:
        config.value = data.theme
    else:
        config = AppConfig(key="theme", value=data.theme)
        db.add(config)

    await db.commit()
    return {"status": "saved"}


@router.get("/last-repo")
async def get_last_repo(db: AsyncSession = Depends(get_db)) -> dict:
    """Get the last active repository ID."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == "last_repo_id"))
    config = result.scalar_one_or_none()
    
    repo_id = None
    if config and config.value:
        try:
            repo_id = int(config.value)
        except ValueError:
            pass
            
    return {"repo_id": repo_id}


@router.post("/last-repo")
async def save_last_repo(
    data: LastRepoRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save the last active repository ID."""
    result = await db.execute(select(AppConfig).where(AppConfig.key == "last_repo_id"))
    config = result.scalar_one_or_none()

    val = str(data.repo_id) if data.repo_id is not None else ""

    if config:
        config.value = val
    else:
        config = AppConfig(key="last_repo_id", value=val)
        db.add(config)

    await db.commit()
    return {"status": "saved"}


# ============================================
#              ASSET DOWNLOAD
# ============================================


@router.post("/download-asset")
async def download_asset(
    data: DownloadAssetRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Download an asset file to local storage."""
    # SSRF Protection: Validate URL before any network request
    try:
        validate_download_url(data.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    
    token = await get_token_only(db, data.token)

    # Get download path
    result = await db.execute(select(AppConfig).where(AppConfig.key == "download_path"))
    path_config = result.scalar_one_or_none()
    base_path = Path(path_config.value if path_config else Path.cwd() / "downloads")

    # Sanitize inputs
    safe_repo_name = sanitize_filename(data.repo_name)
    safe_filename = sanitize_filename(data.filename)
    
    # Construct target paths
    target_dir = base_path / safe_repo_name
    target_file = target_dir / safe_filename
    
    # Path Traversal Check: Ensure target is inside base path
    if not is_safe_path(base_path, target_file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid download path",
        )

    try:
        target_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Permission denied creating {target_dir}",
        )

    # Download the file
    success = await github_service.download_asset(
        data.url,
        str(target_file),
        token,
        db=db,
    )

    if success:
        return {"message": "Download complete", "path": str(target_file)}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download asset",
        )


# ============================================
#              CACHE MANAGEMENT
# ============================================


@router.post("/clear-cache")
async def clear_cache(db: AsyncSession = Depends(get_db)) -> dict:
    """Clear all cached data (user profiles, repos, etc.)."""
    from models.cache import CacheEntry, SearchHistory
    
    await db.execute(delete(CacheEntry))
    await db.commit()
    
    return {"message": "Cache cleared successfully"}


@router.post("/clear-logs")
async def clear_logs(
    days_to_keep: int = 7,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Clear logs older than specified days (default: 7)."""
    from datetime import datetime, timezone, timedelta
    from models.log import Log
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
    
    result = await db.execute(
        delete(Log).where(Log.timestamp < cutoff)
    )
    await db.commit()
    
    deleted_count = result.rowcount
    return {"message": f"Deleted {deleted_count} old log entries", "deleted": deleted_count}
