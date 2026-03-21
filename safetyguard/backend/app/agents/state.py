from typing import TypedDict


class SafetyGuardState(TypedDict, total=False):
    # Inputs
    repo_path: str
    repo_url: str
    branch: str
    enabled_agents: dict[str, bool]
    openapi_spec: dict
    logs: list[str]
    llm_usage_logs: list[dict]

    # Repo understanding
    repo_summary: str
    file_index: list[str]
    service_map: dict
    agentic_workflows: list[dict]
    component_summaries: dict[str, str]

    # Agent findings
    risk_findings: list[dict]
    security_findings: list[dict]
    hallucination_findings: list[dict]
    failure_findings: list[dict]
    cost_findings: list[dict]
    privacy_findings: list[dict]
    observability_findings: list[dict]
    performance_findings: list[dict]
    resource_findings: list[dict]
    redteam_findings: list[dict]

    # Dependency graph
    dependency_graph: dict

    # Output
    final_report: dict
    overall_score: float
    dimension_scores: dict[str, float]

    # Meta
    run_id: str
    status: str
    progress: int
    current_agent: str
    error: str
