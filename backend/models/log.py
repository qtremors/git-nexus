from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class Log(Base):
    __tablename__ = "system_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    level: Mapped[str] = mapped_column(String(20))
    module: Mapped[str] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
