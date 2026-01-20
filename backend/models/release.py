"""
GitNexus v3.1.0 - Release Model

Caches GitHub release data to avoid excessive API calls.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class CachedRelease(Base):
    """Cached release data for a tracked repository."""
    __tablename__ = "cached_releases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("tracked_repos.id", ondelete="CASCADE"), index=True)
    
    # Release info
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_url: Mapped[str] = mapped_column(String(500), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_prerelease: Mapped[bool] = mapped_column(default=False)
    
    # Assets stored as JSON array
    assets: Mapped[dict] = mapped_column(JSON, default=list)
    
    # Cache metadata
    cached_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )
