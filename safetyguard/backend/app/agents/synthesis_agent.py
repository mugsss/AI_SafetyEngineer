"""Synthesis agent: aggregate dimension findings into the final SafetyGuard report."""

from __future__ import annotations

from app.agents.state import SafetyGuardState
from app.utils.scoring import augment_risk_findings, compute_dimension_scores, compute_overall_score

_SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")


def _get_worst_severity(findings: list) -> str:
    """Return the most severe level present in the findings list (critical > … > info)."""
    rank = {s: i for i, s in enumerate(_SEVERITY_ORDER)}
    best_idx = len(_SEVERITY_ORDER)
    worst = "info"
    for item in findings:
        if not isinstance(item, dict):
            continue
        sev = str(item.get("severity", "info")).lower()
        idx = rank.get(sev, rank["info"])
        if idx < best_idx:
            best_idx = idx
            worst = sev if sev in rank else "info"
    return worst


def _generate_summary(dim_name: str, data: dict) -> str:
    """Short human-readable summary for one dimension."""
    count = int(data.get("finding_count", 0))
    worst = str(data.get("worst_severity", "info"))
    score = float(data.get("score", 100))
    titles: list[str] = []
    for f in data.get("findings") or []:
        if isinstance(f, dict) and f.get("title"):
            titles.append(str(f["title"]))
    if count == 0:
        return f"No issues detected for {dim_name}."
    preview = "; ".join(titles[:3])
    if len(titles) > 3:
        preview += " …"
    return (
        f"{dim_name}: {count} finding(s), worst severity {worst}. "
        f"Score {score:.0f}/100. Highlights: {preview}"
    )


def _generate_executive_summary(
    score: float,
    dim_scores: dict[str, float],
    all_findings: dict,
) -> str:
    """Overall narrative for leadership: score, weakest areas, and severity mix."""
    weakest = sorted(dim_scores.items(), key=lambda x: x[1])[:3]
    weakest_txt = ", ".join(f"{d} ({s:.0f})" for d, s in weakest) if weakest else "n/a"

    crit = high = 0
    for _dim, data in all_findings.items():
        if not isinstance(data, dict):
            continue
        for f in data.get("findings") or []:
            if not isinstance(f, dict):
                continue
            sev = str(f.get("severity", "info")).lower()
            if sev == "critical":
                crit += 1
            elif sev == "high":
                high += 1

    posture = "strong"
    if score < 60:
        posture = "needs urgent remediation"
    elif score < 75:
        posture = "needs improvement"
    elif score < 90:
        posture = "acceptable with gaps"

    return (
        f"Overall SafetyGuard score is {score:.1f}/100 ({posture}). "
        f"Lowest-scoring dimensions: {weakest_txt}. "
        f"Severity mix: {crit} critical, {high} high across all dimensions. "
        "Prioritize fixes that reduce critical/high items in security, privacy, and red-team surfaces."
    )


def _default_dependency_graph() -> dict:
    """Fallback topology when the pipeline has not produced a graph yet."""
    return {
        "nodes": [
            {"id": "api", "label": "FastAPI Service", "type": "api"},
            {"id": "llm", "label": "LLM Runtime", "type": "llm"},
            {"id": "db", "label": "Application DB", "type": "database"},
            {"id": "cache", "label": "Redis Cache", "type": "database"},
            {"id": "queue", "label": "Task Queue", "type": "queue"},
            {"id": "vendor", "label": "External Model API", "type": "external"},
        ],
        "edges": [
            {"source": "api", "target": "llm", "relation": "invoke"},
            {"source": "api", "target": "db", "relation": "persist"},
            {"source": "api", "target": "cache", "relation": "session"},
            {"source": "api", "target": "queue", "relation": "enqueue"},
            {"source": "queue", "target": "llm", "relation": "batch_infer"},
            {"source": "llm", "target": "vendor", "relation": "completion"},
            {"source": "llm", "target": "db", "relation": "telemetry"},
        ],
    }


async def synthesis_agent(state: SafetyGuardState) -> dict:
    """Aggregate findings from dimension agents and produce the final report."""
    all_findings: dict = {}
    dimension_keys = [
        ("risk", "risk_findings"),
        ("security", "security_findings"),
        ("hallucinations", "hallucination_findings"),
        ("failures", "failure_findings"),
        ("cost", "cost_findings"),
        ("privacy", "privacy_findings"),
        ("observability", "observability_findings"),
        ("performance", "performance_findings"),
        ("resources", "resource_findings"),
        ("redteam", "redteam_findings"),
    ]

    enabled = state.get("enabled_agents", {})
    for dim_name, findings_key in dimension_keys:
        if not enabled.get(dim_name, False):
            continue
        findings = state.get(findings_key, [])
        if not isinstance(findings, list):
            findings = []
        all_findings[dim_name] = {
            "findings": findings,
            "finding_count": len(findings),
            "worst_severity": _get_worst_severity(findings),
        }

    dimension_scores = compute_dimension_scores(all_findings)
    overall_score = compute_overall_score(dimension_scores)

    for dim_name, data in all_findings.items():
        data["score"] = dimension_scores.get(dim_name, 100)
        data["summary"] = _generate_summary(dim_name, data)

    augment_risk_findings(all_findings, dimension_scores)

    executive_summary = _generate_executive_summary(overall_score, dimension_scores, all_findings)

    dep_graph = state.get("dependency_graph", _default_dependency_graph())
    if not isinstance(dep_graph, dict):
        dep_graph = _default_dependency_graph()

    final_report = {
        "overall_score": overall_score,
        "executive_summary": executive_summary,
        "dimension_scores": dimension_scores,
        "findings": all_findings,
        "dependency_graph": dep_graph,
    }

    return {
        "final_report": final_report,
        "overall_score": overall_score,
        "dimension_scores": dimension_scores,
        "dependency_graph": dep_graph,
        "current_agent": "synthesis",
        "progress": 95,
        "status": "running",
    }
