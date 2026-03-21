from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.report import SafetyReport
from app.models.run import AnalysisRun
from app.models.user import User
from app.dependencies import get_current_user
from app.services.simulator_service import simulate_failure

router = APIRouter()


class SimulateInput(BaseModel):
    run_id: str
    node_id: str
    failure_type: str  # full_outage | high_latency | partial_degradation


class SimulationResult(BaseModel):
    impacted_nodes: list[str]
    narrative: str
    dimension_impacts: dict[str, float]


@router.post("/simulate", response_model=SimulationResult)
async def simulate(
    data: SimulateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.id == data.run_id, AnalysisRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    report = db.query(SafetyReport).filter(SafetyReport.run_id == data.run_id).first()
    if not report or not report.dependency_graph:
        raise HTTPException(status_code=404, detail="Dependency graph not found")

    result = await simulate_failure(
        dependency_graph=report.dependency_graph,
        node_id=data.node_id,
        failure_type=data.failure_type,
    )
    return result
