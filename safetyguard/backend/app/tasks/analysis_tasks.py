import logging
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


def execute_analysis(run_id: str) -> dict:
    """Core analysis logic -- runs independently of Celery."""
    from app.database import SessionLocal
    from app.models.run import AnalysisRun
    from app.models.report import SafetyReport
    from app.services.repo_service import clone_repo, extract_upload, cleanup_repo
    from app.utils.mock_data import get_mock_findings, get_mock_dependency_graph
    from app.utils.scoring import compute_dimension_scores, compute_overall_score

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
                enabled = run.enabled_agents.get(dim_name, False)
                dim_findings = findings if enabled else []
                worst = "info"
                severity_order = ["critical", "high", "medium", "low", "info"]
                for f in dim_findings:
                    sev = f.get("severity", "info")
                    if severity_order.index(sev) < severity_order.index(worst):
                        worst = sev
                all_findings[dim_name] = {
                    "findings": dim_findings,
                    "finding_count": len(dim_findings),
                    "worst_severity": worst,
                    "score": 100,
                    "summary": f"{'No' if not dim_findings else len(dim_findings)} {dim_name} issues found.",
                }

            dimension_scores = compute_dimension_scores(all_findings)
            overall_score = compute_overall_score(dimension_scores)

            for dim_name in all_findings:
                all_findings[dim_name]["score"] = dimension_scores.get(dim_name, 100)

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

        initial_state = {
            "repo_path": repo_path,
            "repo_url": run.repo_url or "",
            "branch": run.branch,
            "enabled_agents": run.enabled_agents or {},
            "run_id": run_id,
            "status": "running",
            "progress": 0,
            "current_agent": "initializing",
        }

        graph = build_safety_analysis_graph().compile()

        import asyncio
        result = asyncio.run(graph.ainvoke(initial_state))

        final_report = result.get("final_report", {})
        report = SafetyReport(
            run_id=run_id,
            overall_score=final_report.get("overall_score", 0),
            dimension_scores=final_report.get("dimension_scores", {}),
            findings=final_report.get("findings", {}),
            dependency_graph=final_report.get("dependency_graph"),
            executive_summary=final_report.get("executive_summary", ""),
        )
        db.add(report)
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        db.commit()

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
