from pydantic import BaseModel, Field


class ReportResponse(BaseModel):
    id: str
    run_id: str
    overall_score: float
    dimension_scores: dict
    findings: dict
    dependency_graph: dict | None
    code_graph: dict | None = None
    code_index_status: str | None = None
    code_index_error: str | None = None
    executive_summary: str | None
    created_at: str

    model_config = {"from_attributes": True}


class DependencyGraphResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class CodeRetrievalRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(8, ge=1, le=32)
    hops: int = Field(2, ge=0, le=4)


class CodeRetrievalResponse(BaseModel):
    chunks: list[dict]
    expanded_node_ids: list[str]
    highlight_edge_ids: list[str]
    subgraph_nodes: list[dict]
    subgraph_edges: list[dict]
    error: str | None = None
