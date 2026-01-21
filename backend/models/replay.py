from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Repository(Base):
    """Git repository for the Replay feature."""

    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False)
    remote_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    
    # Relationship to commits
    commits: Mapped[list["Commit"]] = relationship(
        "Commit", back_populates="repository", cascade="all, delete-orphan"
    )


class Commit(Base):
    """Git commit stored in the database with sequential numbering."""

    __tablename__ = "commits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("repositories.id"), nullable=False, index=True)
    hash: Mapped[str] = mapped_column(String(40), nullable=False)
    short_hash: Mapped[str] = mapped_column(String(7), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(200), nullable=False)
    author_email: Mapped[str] = mapped_column(String(200), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    commit_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # oldest = 1, newest = highest
    
    # Relationship to repository
    repository: Mapped["Repository"] = relationship("Repository", back_populates="commits")

    __table_args__ = (
        Index("ix_commits_repo_hash", "repo_id", "hash"),  # Fast hash lookup within repo
    )
