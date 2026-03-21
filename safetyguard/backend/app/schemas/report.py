from pydantic import BaseModel


class ReportResponse(BaseModel):
    id: str
    run_id: str
    overall_score: float
    dimension_scores: dict
    findings: dict
    dependency_graph: dict | None
    executive_summary: str | None
    created_at: str

    model_config = {"from_attributes": True}


class DependencyGraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]
