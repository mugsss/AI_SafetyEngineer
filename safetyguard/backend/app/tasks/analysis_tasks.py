import logging
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


def execute_analysis(run_id: str) -> dict:
    """Core analysis logic -- runs independently of Celery.

    Always uses the full LangGraph pipeline. In mock mode the agents perform
    static analysis only (no LLM calls), so this is fast and still produces
    real findings based on the actual repository code.
    """
    from app.database import SessionLocal
    from app.models.run import AnalysisRun
    from app.models.report import SafetyReport
    from app.services.repo_service import clone_repo, extract_upload, cleanup_repo
    from app.utils.mock_data import get_mock_findings, get_mock_dependency_graph
    from app.utils.scoring import augment_risk_findings, compute_dimension_scores, compute_overall_score
    from app.utils.severity import canonical_severity, severity_rank

    db = SessionLocal()
    repo_path = None

    try:
        run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
        if not run:
            logger.error(f"Run {run_id} not found")
            return {"error": "Run not found"}

        run.status = "running"
        run.started_at = datetime.utcnow()
        db.commit()

        if settings.is_mock_mode:
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
                    "summary": (
                        f"{len(findings)} {dim_name} issues found."
                        if findings
                        else f"No {dim_name} issues found."
                    ),
                }

            dimension_scores = compute_dimension_scores(all_findings)
            overall_score = compute_overall_score(dimension_scores, all_findings)

            for dim_name in all_findings:
                all_findings[dim_name]["score"] = dimension_scores.get(dim_name, 100)

            augment_risk_findings(all_findings, dimension_scores)

            executive_summary = (
                f"SafetyGuard analysis complete. Overall safety score: {overall_score}/100. "
                f"Found issues across multiple dimensions. "
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

            return {"status": "completed", "overall_score": overall_score}

        if run.repo_url:
            repo_path = clone_repo(run.repo_url, run.branch)
        elif run.upload_id:
            repo_path = extract_upload(run.upload_id)
        else:
            raise ValueError("No repo_url or upload_id provided")

        from app.agents.workflows import build_safety_analysis_graph
        from app.services.code_index_service import index_codebase
        from app.utils.file_tools import set_run_id, set_code_graph_for_rag

        idx_result = {"graph": None, "status": "skipped", "error": None, "vector_index_ready": False}
        try:
            idx_result = index_codebase(run_id, repo_path)
        except Exception as e:
            logger.warning("Code indexing failed (continuing analysis): %s", e)
            idx_result = {
                "graph": None,
                "status": "failed",
                "error": str(e)[:2000],
                "vector_index_ready": False,
            }

        set_run_id(run_id)
        set_code_graph_for_rag(idx_result.get("graph"))

        initial_state = {
            "repo_path": repo_path,
            "repo_url": run.repo_url or "",
            "branch": run.branch,
            "enabled_agents": run.enabled_agents or {},
            "run_id": run_id,
            "status": "running",
            "progress": 0,
            "current_agent": "initializing",
            "code_graph": idx_result.get("graph"),
            "code_index_status": idx_result.get("status"),
            "code_index_error": idx_result.get("error"),
        }

        graph = build_safety_analysis_graph().compile()

        import asyncio

        try:
            result = asyncio.run(graph.ainvoke(initial_state))
        finally:
            set_run_id("")
            set_code_graph_for_rag(None)

        final_report = result.get("final_report", {})
        report = SafetyReport(
            run_id=run_id,
            overall_score=final_report.get("overall_score", 0),
            dimension_scores=final_report.get("dimension_scores", {}),
            findings=final_report.get("findings", {}),
            dependency_graph=final_report.get("dependency_graph"),
            executive_summary=final_report.get("executive_summary", ""),
            code_graph=final_report.get("code_graph"),
            code_index_status=final_report.get("code_index_status"),
            code_index_error=final_report.get("code_index_error"),
        )
        db.add(report)
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        db.commit()

        from app.utils.n8n_webhook import emit_workflow_event

        base = (settings.FRONTEND_BASE_URL or "").rstrip("/")
        emit_workflow_event(
            "analysis.completed",
            run_id=run_id,
            status="completed",
            user_id=run.user_id,
            extra={
                "repo_url": run.repo_url or "",
                "branch": run.branch or "",
                "overall_score": final_report.get("overall_score"),
                "dimension_scores": final_report.get("dimension_scores") or {},
                "executive_summary": (final_report.get("executive_summary") or "")[:2000],
                "links": {
                    "report": f"{base}/report/{run_id}" if base else f"/report/{run_id}",
                },
            },
        )

        return {"status": "completed", "overall_score": final_report.get("overall_score", 0)}

    except Exception as e:
        logger.exception(f"Analysis task failed for run {run_id}")
        try:
            run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error_message = str(e)[:2000]
                run.finished_at = datetime.utcnow()
                db.commit()
                from app.utils.n8n_webhook import emit_workflow_event

                base = (settings.FRONTEND_BASE_URL or "").rstrip("/")
                emit_workflow_event(
                    "analysis.failed",
                    run_id=run_id,
                    status="failed",
                    user_id=run.user_id,
                    extra={
                        "repo_url": run.repo_url or "",
                        "error_message": str(e)[:2000],
                        "links": {
                            "report": f"{base}/report/{run_id}" if base else f"/report/{run_id}",
                        },
                    },
                )
        except Exception:
            pass
        return {"error": str(e)}
    finally:
        db.close()
        if repo_path:
            cleanup_repo(repo_path)


try:
    from celery import Celery

    celery_app = Celery(
        "safetyguard",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )

    @celery_app.task(name="run_analysis", bind=True, max_retries=1)
    def run_analysis(self, run_id: str) -> dict:
        return execute_analysis(run_id)

except Exception:
    celery_app = None

    def run_analysis(run_id: str) -> dict:
        return execute_analysis(run_id)
