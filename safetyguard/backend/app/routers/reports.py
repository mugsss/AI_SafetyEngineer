from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.report import SafetyReport
from app.models.run import AnalysisRun
from app.models.user import User
from app.schemas.report import ReportResponse, DependencyGraphResponse
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/{run_id}", response_model=ReportResponse)
def get_report(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.id == run_id, AnalysisRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    report = db.query(SafetyReport).filter(SafetyReport.run_id == run_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse(
        id=report.id,
        run_id=report.run_id,
        overall_score=report.overall_score,
        dimension_scores=report.dimension_scores,
        findings=report.findings,
        dependency_graph=report.dependency_graph,
        executive_summary=report.executive_summary,
        created_at=report.created_at.isoformat(),
    )


@router.get("/{run_id}/dependency-graph", response_model=DependencyGraphResponse)
def get_dependency_graph(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.id == run_id, AnalysisRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    report = db.query(SafetyReport).filter(SafetyReport.run_id == run_id).first()
    if not report or not report.dependency_graph:
        raise HTTPException(status_code=404, detail="Dependency graph not found")

    return DependencyGraphResponse(
        nodes=report.dependency_graph.get("nodes", []),
        edges=report.dependency_graph.get("edges", []),
    )


@router.post("/{run_id}/miro-board")
async def create_miro_board(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.MIRO_ACCESS_TOKEN:
        raise HTTPException(
            status_code=400,
            detail="MIRO_ACCESS_TOKEN is not configured. Set it in .env to enable Miro integration.",
        )

    run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.id == run_id, AnalysisRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    report = db.query(SafetyReport).filter(SafetyReport.run_id == run_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report_data = {
        "overall_score": report.overall_score,
        "dimension_scores": report.dimension_scores or {},
        "findings": report.findings or {},
        "dependency_graph": report.dependency_graph or {},
        "executive_summary": report.executive_summary or "",
    }

    from app.services.miro_service import create_board_for_run

    try:
        result = await create_board_for_run(
            run_id=run_id,
            repo_url=run.repo_url or "",
            report=report_data,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Miro API error: {str(e)}")

    return result
