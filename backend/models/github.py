from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class GitHubCommit(Base):
    """
    Persistent storage for GitHub commits.
    Used for generating contribution graphs without API calls.
    """
    __tablename__ = "github_commits"

    sha: Mapped[str] = mapped_column(String(40), primary_key=True)
    repo_owner: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    repo_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    author_name: Mapped[str] = mapped_column(String(100))
    author_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(255))
    
    # Composite index for querying by repo and date
    __table_args__ = (
        UniqueConstraint('sha', name='uq_commit_sha'),
    )


class ApiStatus(Base):
    """
    Singleton-like table to track GitHub API rate limits.
    """
    __tablename__ = "api_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    limit: Mapped[int] = mapped_column(Integer, default=5000)
    remaining: Mapped[int] = mapped_column(Integer, default=5000)
    reset_time: Mapped[int] = mapped_column(Integer, default=0)  # Unix timestamp
    token_source: Mapped[str] = mapped_column(String(10), default="none")  # 'env', 'db', 'none'
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc)
    )
