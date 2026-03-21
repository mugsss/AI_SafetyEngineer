import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.run import AnalysisRun
from app.schemas.run import CreateRunInput, RunResponse, RunListResponse
from app.dependencies import get_current_user

router = APIRouter()


def _run_to_response(run: AnalysisRun) -> RunResponse:
    return RunResponse(
        id=run.id,
        user_id=run.user_id,
        repo_url=run.repo_url,
        upload_id=run.upload_id,
        branch=run.branch,
        status=run.status,
        enabled_agents=run.enabled_agents or {},
        started_at=run.started_at.isoformat() if run.started_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
        error_message=run.error_message,
        created_at=run.created_at.isoformat(),
    )


@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
def create_run(
    data: CreateRunInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not data.repo_url and not data.upload_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either repo_url or upload_id must be provided",
        )

    run = AnalysisRun(
        user_id=current_user.id,
        repo_url=data.repo_url,
        upload_id=data.upload_id,
        branch=data.branch,
        enabled_agents=data.enabled_agents,
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    from app.config import settings
    if settings.is_mock_mode:
        _run_mock_analysis(run.id, db)
        db.refresh(run)
    else:
        _dispatch_analysis(run.id)

    return _run_to_response(run)


def _dispatch_analysis(run_id: str) -> None:
    """Try Celery first; fall back to a background thread."""
    try:
        from app.tasks.analysis_tasks import run_analysis, celery_app
        if celery_app is not None:
            run_analysis.delay(run_id)
            return
    except Exception:
        pass

    import threading
    from app.tasks.analysis_tasks import execute_analysis
    threading.Thread(target=execute_analysis, args=(run_id,), daemon=True).start()


@router.get("", response_model=RunListResponse)
def list_runs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.user_id == current_user.id)
        .order_by(AnalysisRun.created_at.desc())
    )
    total = query.count()
    runs = query.offset((page - 1) * limit).limit(limit).all()

    return RunListResponse(
        runs=[_run_to_response(r) for r in runs],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{run_id}", response_model=RunResponse)
def get_run(
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
    return _run_to_response(run)


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.report import SafetyReport

    run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.id == run_id, AnalysisRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    db.query(SafetyReport).filter(SafetyReport.run_id == run_id).delete()
    db.delete(run)
    db.commit()


@router.get("/{run_id}/status")
async def run_status_sse(
    run_id: str,
    db: Session = Depends(get_db),
):
    async def event_stream():
        while True:
            run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
            if not run:
                yield f"event: error\ndata: {json.dumps({'error': 'Run not found'})}\n\n"
                return

            event_data = {
                "status": run.status,
                "progress": _estimate_progress(run),
                "current_agent": _get_current_agent(run),
            }
            yield f"event: status\ndata: {json.dumps(event_data)}\n\n"

            if run.status in ("completed", "failed"):
                return

            db.expire_all()
            await asyncio.sleep(3)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _estimate_progress(run: AnalysisRun) -> int:
    if run.status == "completed":
        return 100
    if run.status == "failed":
        return 0
    if run.status == "pending":
        return 0
    if run.status == "running":
        if run.started_at:
            elapsed = (datetime.utcnow() - run.started_at).total_seconds()
            return min(int(elapsed / 3), 95)
        return 10
    return 0


def _get_current_agent(run: AnalysisRun) -> str:
    if run.status == "completed":
        return "done"
    if run.status == "pending":
        return "waiting"
    return "analyzing"


def _run_mock_analysis(run_id: str, db: Session) -> None:
    from app.models.report import SafetyReport
    from app.utils.mock_data import get_mock_findings, get_mock_dependency_graph
    from app.utils.scoring import compute_dimension_scores, compute_overall_score

    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        return

    run.status = "running"
    run.started_at = datetime.utcnow()
    db.commit()

    mock_findings = get_mock_findings()
    mock_graph = get_mock_dependency_graph()

    all_findings = {}
    severity_order = ["critical", "high", "medium", "low", "info"]
    for dim_name, findings in mock_findings.items():
        enabled = (run.enabled_agents or {}).get(dim_name, False)
        dim_findings = findings if enabled else []
        worst = "info"
        for f in dim_findings:
            sev = f.get("severity", "info")
            if severity_order.index(sev) < severity_order.index(worst):
                worst = sev
        all_findings[dim_name] = {
            "findings": dim_findings,
            "finding_count": len(dim_findings),
            "worst_severity": worst,
            "summary": f"{len(dim_findings)} {dim_name} issues found." if dim_findings else f"No {dim_name} issues found.",
        }

    dimension_scores = compute_dimension_scores(all_findings)
    overall_score = compute_overall_score(dimension_scores)

    for dim_name in all_findings:
        all_findings[dim_name]["score"] = dimension_scores.get(dim_name, 100)

    executive_summary = (
        f"SafetyGuard analysis complete. Overall safety score: {overall_score}/100. "
        f"Key areas of concern: "
        + ", ".join(
            f"{d} ({s:.0f})"
            for d, s in sorted(dimension_scores.items(), key=lambda x: x[1])[:3]
        )
        + "."
    )

    report = SafetyReport(
        run_id=run_id,
        overall_score=overall_score,
        dimension_scores=dimension_scores,
        findings=all_findings,
        dependency_graph=mock_graph,
        executive_summary=executive_summary,
    )
    db.add(report)
    run.status = "completed"
    run.finished_at = datetime.utcnow()
    db.commit()
