from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.report import SafetyReport
from app.models.run import AnalysisRun
from app.models.user import User
from app.schemas.report import (
    ReportResponse,
    DependencyGraphResponse,
    CodeRetrievalRequest,
    CodeRetrievalResponse,
)
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
        code_graph=report.code_graph,
        code_index_status=report.code_index_status,
        code_index_error=report.code_index_error,
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


@router.get("/{run_id}/code-graph")
def get_code_graph(
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
    if not report or not report.code_graph:
        raise HTTPException(status_code=404, detail="Code graph not found")

    cg = report.code_graph
    if not isinstance(cg, dict):
        raise HTTPException(status_code=404, detail="Code graph not found")
    return {
        "nodes": cg.get("nodes", []),
        "edges": cg.get("edges", []),
        "stats": cg.get("stats", {}),
        "code_index_status": report.code_index_status,
        "code_index_error": report.code_index_error,
    }


@router.post("/{run_id}/code-retrieval", response_model=CodeRetrievalResponse)
def post_code_retrieval(
    run_id: str,
    body: CodeRetrievalRequest,
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

    from app.services.code_rag_service import retrieve

    r = retrieve(
        report.code_graph,
        run_id,
        body.query,
        top_k=body.top_k,
        hop_limit=body.hops,
    )
    return CodeRetrievalResponse(
        chunks=r.get("chunks") or [],
        expanded_node_ids=r.get("expanded_node_ids") or [],
        highlight_edge_ids=r.get("highlight_edge_ids") or [],
        subgraph_nodes=r.get("subgraph_nodes") or [],
        subgraph_edges=r.get("subgraph_edges") or [],
        error=r.get("error"),
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
