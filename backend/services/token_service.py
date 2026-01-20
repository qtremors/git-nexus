"""
GitNexus - Token Service

Centralized token management for the application.
Handles retrieval of effective token from .env or database.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.config import AppConfig
from utils.crypto import crypto_manager

logger = logging.getLogger("gitnexus.token")


async def get_effective_token(db: AsyncSession, request_token: str | None = None) -> tuple[str | None, str]:
    """
    Get effective token with source information.
    
    Priority:
    1. Request-provided token (if any)
    2. Environment variable (GITHUB_TOKEN from .env)
    3. Database-stored token (encrypted)
    
    Args:
        db: Database session
        request_token: Token provided in the request (optional)
        
    Returns:
        Tuple of (token, source) where source is 'request', 'env', 'db', or 'none'
    """
    # 1. Check request-provided token
    if request_token and request_token.strip():
        return request_token.strip(), "request"

    # 2. Check .env
    if settings.github_token:
        return settings.github_token, "env"

    # 3. Check DB
    result = await db.execute(select(AppConfig).where(AppConfig.key == "github_token"))
    config = result.scalar_one_or_none()
    
    if config and config.value:
        try:
            decrypted = crypto_manager.decrypt(config.value)
            if decrypted:
                return decrypted, "db"
        except Exception as e:
            logger.warning(f"Failed to decrypt token from DB: {e}")
            return None, "none"
    
    return None, "none"


async def get_token_only(db: AsyncSession, request_token: str | None = None) -> str | None:
    """
    Get effective token without source information.
    
    Convenience wrapper for cases where only the token value is needed.
    """
    token, _ = await get_effective_token(db, request_token)
    return token
