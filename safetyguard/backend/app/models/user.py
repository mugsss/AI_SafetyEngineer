from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="user")  # noqa: F821
    workflow_webhooks: Mapped[list["WorkflowWebhook"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
    )
    app_settings_row: Mapped["UserAppSettings | None"] = relationship(  # noqa: F821
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
