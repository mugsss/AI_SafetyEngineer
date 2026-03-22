import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.run import AnalysisRun
from app.schemas.run import CreateRunInput, RunResponse, RunListResponse
from app.dependencies import get_current_user
from app.utils.severity import canonical_severity, severity_rank

router = APIRouter()
logger = logging.getLogger(__name__)


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

    try:
        if settings.is_mock_mode:
            _run_mock_analysis(run.id, db)
            db.refresh(run)
        else:
            _dispatch_analysis(run.id)
    except Exception as e:
        logger.exception("Failed to start analysis for run %s", run.id)
        run = db.query(AnalysisRun).filter(AnalysisRun.id == run.id).first()
        if run:
            run.status = "failed"
            run.error_message = str(e)[:2000]
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed to start: {e!s}",
        ) from e

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
    from app.services.code_index_service import cleanup_code_index

    cleanup_code_index(run_id)
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
                # Default event type "message" so EventSource.onmessage receives it
                yield f"data: {json.dumps({'error': 'Run not found', 'status': 'failed'})}\n\n"
                return

            progress = _estimate_progress(run)
            msg = _status_message(run, progress)
            event_data = {
                "run_id": run_id,
                "status": run.status,
                "progress": progress,
                "message": msg,
            }
            # Must NOT use a custom event name — browsers only deliver those to addEventListener('name').
            yield f"data: {json.dumps(event_data)}\n\n"

            if run.status in ("completed", "failed"):
                return

            db.expire_all()
            await asyncio.sleep(2)

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
        return 2
    if run.status == "running":
        if run.started_at:
            elapsed = (datetime.utcnow() - run.started_at).total_seconds()
            # Time-based visual only — not real pipeline %. Caps at 90% until done.
            return min(5 + int(elapsed / 5), 90)
        return 8
    return 0


def _status_message(run: AnalysisRun, progress: int) -> str:
    if run.status == "pending":
        return "Queued — starting soon…"
    if run.status == "completed":
        return "Done"
    if run.status == "failed":
        return "Failed"
    if run.status == "running" and run.started_at:
        elapsed = int((datetime.utcnow() - run.started_at).total_seconds())
        m, s = elapsed // 60, elapsed % 60
        # Clarify: % is not “work done”, only elapsed-time estimate
        if progress >= 90:
            return (
                f"Still running — {m}m {s}s elapsed. "
                "The bar above is a time estimate, not exact completion; "
                "agents may still be analyzing. Large repos often take 15–45+ min."
            )
        return (
            f"Analyzing repository and agents… {m}m {s}s elapsed "
            f"(estimate ~{progress}% — will approach 90% then wait until finished)."
        )
    return "Starting analysis…"


def _run_mock_analysis(run_id: str, db: Session) -> None:
    from app.models.report import SafetyReport
    from app.utils.mock_data import get_mock_findings, get_mock_dependency_graph
    from app.utils.scoring import augment_risk_findings, compute_dimension_scores, compute_overall_score

    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        return

    run.status = "running"
    run.started_at = datetime.utcnow()
    db.commit()

    mock_findings = get_mock_findings()
    mock_graph = get_mock_dependency_graph()

    all_findings = {}
    for dim_name, findings in mock_findings.items():
        enabled = (run.enabled_agents or {}).get(dim_name, False)
        if not enabled:
            continue
        worst_raw = "info"
        for f in findings:
            raw = str(f.get("severity", "info"))
            if severity_rank(raw) < severity_rank(worst_raw):
                worst_raw = raw
        all_findings[dim_name] = {
            "findings": findings,
            "finding_count": len(findings),
            "worst_severity": canonical_severity(worst_raw),
            "summary": f"{len(findings)} {dim_name} issues found." if findings else f"No {dim_name} issues found.",
        }

    dimension_scores = compute_dimension_scores(all_findings)
    overall_score = compute_overall_score(dimension_scores, all_findings)

    for dim_name in all_findings:
        all_findings[dim_name]["score"] = dimension_scores.get(dim_name, 100)

    augment_risk_findings(all_findings, dimension_scores)

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
