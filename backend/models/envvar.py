from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class EnvVar(Base):
    """Scoped environment variable for Replay servers."""

    __tablename__ = "env_vars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(1000), nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)  # global, project, commit
    repository_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=True
    )
    commit_hash: Mapped[str | None] = mapped_column(String(40), nullable=True)
