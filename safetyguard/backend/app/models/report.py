import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analysis_runs.id"), unique=True
    )
    overall_score: Mapped[float] = mapped_column(Float)
    dimension_scores: Mapped[dict] = mapped_column(JSON)
    findings: Mapped[dict] = mapped_column(JSON)
    dependency_graph: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    code_graph: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    code_index_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    code_index_error: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    executive_summary: Mapped[str | None] = mapped_column(String(5000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    run: Mapped["AnalysisRun"] = relationship(back_populates="report")  # noqa: F821
