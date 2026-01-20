from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from constants import RepoStatus
from database import Base


class TrackedRepo(Base):
    """Repository tracked in the watchlist."""

    __tablename__ = "tracked_repos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(80), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(80), nullable=False)

    # Version tracking
    current_version: Mapped[str] = mapped_column(String(50), default=RepoStatus.UNKNOWN)
    latest_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Metadata
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    last_checked: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Ordering
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("owner", "repo_name", name="_owner_repo_uc"),
    )
