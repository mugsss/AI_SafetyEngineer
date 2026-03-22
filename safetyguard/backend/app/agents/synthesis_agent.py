"""Synthesis agent: aggregate dimension findings into the final SafetyGuard report."""

from __future__ import annotations

from app.agents.state import SafetyGuardState
from app.utils.scoring import augment_risk_findings, compute_dimension_scores, compute_overall_score

_SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")

_DIMENSION_LABELS = {
    "risk": "Risk Assessment",
    "security": "Security",
    "hallucinations": "Hallucination & Grounding",
    "failures": "Failure Modes & Reliability",
    "cost": "Cost & Efficiency",
    "privacy": "Privacy & Data Protection",
    "observability": "Observability & Monitoring",
    "performance": "Performance & Latency",
    "resources": "Resource Management",
    "redteam": "Red Team & Adversarial",
}


def _get_worst_severity(findings: list) -> str:
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
    count = int(data.get("finding_count", 0))
    worst = str(data.get("worst_severity", "info"))
    score = float(data.get("score", 100))
    label = _DIMENSION_LABELS.get(dim_name, dim_name.title())

    if count == 0:
        return f"{label}: No issues detected. Score {score:.0f}/100."

    sev_counts: dict[str, int] = {}
    titles: list[str] = []
    for f in data.get("findings") or []:
        if not isinstance(f, dict):
            continue
        sev = str(f.get("severity", "info")).lower()
        sev_counts[sev] = sev_counts.get(sev, 0) + 1
        if f.get("title"):
            titles.append(str(f["title"]))

    sev_breakdown = ", ".join(
        f"{c} {s}"
        for s, c in sorted(
            sev_counts.items(),
            key=lambda x: _SEVERITY_ORDER.index(x[0]) if x[0] in _SEVERITY_ORDER else 99,
        )
        if c > 0
    )

    preview = "; ".join(titles[:3])
    if len(titles) > 3:
        preview += f" (+{len(titles) - 3} more)"

    return (
        f"{label}: {count} finding(s) ({sev_breakdown}), worst severity {worst}. "
        f"Score {score:.0f}/100. Key issues: {preview}"
    )


def _generate_recommendations(all_findings: dict) -> list[dict]:
    """Generate prioritized, actionable recommendations from findings."""
    recommendations: list[dict] = []
    severity_rank = {s: i for i, s in enumerate(_SEVERITY_ORDER)}

    all_items: list[tuple[int, str, dict]] = []
    for dim_name, data in all_findings.items():
        if not isinstance(data, dict):
            continue
        for f in data.get("findings") or []:
            if not isinstance(f, dict):
                continue
            sev = str(f.get("severity", "info")).lower()
            rank = severity_rank.get(sev, 99)
            all_items.append((rank, dim_name, f))

    all_items.sort(key=lambda x: x[0])

    seen_fixes: set[str] = set()
    for _rank, dim_name, finding in all_items[:15]:
        fix = finding.get("suggested_fix", "")
        title = finding.get("title", "")
        if not fix or fix.lower() in seen_fixes:
            continue
        seen_fixes.add(fix.lower())

        label = _DIMENSION_LABELS.get(dim_name, dim_name.title())
        sev = finding.get("severity", "info")
        priority = "P0" if sev == "critical" else "P1" if sev == "high" else "P2"

        recommendations.append({
            "priority": priority,
            "dimension": dim_name,
            "dimension_label": label,
            "title": title,
            "severity": sev,
            "action": fix,
            "file": finding.get("evidence", {}).get("file", ""),
        })

    return recommendations


def _generate_executive_summary(
    score: float,
    dim_scores: dict[str, float],
    all_findings: dict,
    recommendations: list[dict],
) -> str:
    """Narrative for leadership: merges weighted scoring context + P0/P1 actions."""
    # Weakest dimensions: only those that actually produced findings (feature/testing)
    scored_dims = {
        dim: s
        for dim, s in dim_scores.items()
        if (all_findings.get(dim, {}).get("finding_count", 0) or 0) > 0
    }
    weakest = sorted(scored_dims.items(), key=lambda x: x[1])[:3]
    weakest_txt = (
        ", ".join(f"{_DIMENSION_LABELS.get(d, d)} ({s:.0f})" for d, s in weakest)
        if weakest
        else "no scored findings yet"
    )

    # Strongest among all analyzed dimensions (merge-n8n behavior)
    strongest = sorted(dim_scores.items(), key=lambda x: x[1], reverse=True)[:2]
    strongest_txt = (
        ", ".join(f"{_DIMENSION_LABELS.get(d, d)} ({s:.0f})" for d, s in strongest)
        if strongest
        else "n/a"
    )

    crit = high = med = 0
    total_findings = 0
    for _dim, data in all_findings.items():
        if not isinstance(data, dict):
            continue
        for f in data.get("findings") or []:
            if not isinstance(f, dict):
                continue
            total_findings += 1
            sev = str(f.get("severity", "info")).lower()
            if sev == "critical":
                crit += 1
            elif sev == "high":
                high += 1
            elif sev == "medium":
                med += 1

    agents_run = len(dim_scores)
    agents_with_findings = len(scored_dims)

    posture = "strong"
    if score < 50:
        posture = "critical — requires immediate remediation"
    elif score < 65:
        posture = "poor — significant gaps need urgent attention"
    elif score < 75:
        posture = "fair — several areas need improvement"
    elif score < 90:
        posture = "good with identified gaps"

    p0_actions = [r for r in recommendations if r["priority"] == "P0"]
    p1_actions = [r for r in recommendations if r["priority"] == "P1"]

    lines = [
        f"Overall SafetyGuard score: {score:.1f}/100 ({posture}).",
        f"Analyzed across {agents_run} safety dimension(s) with {total_findings} total finding(s).",
        f"Severity breakdown: {crit} critical, {high} high, {med} medium.",
        "",
        f"Weakest areas (among dimensions with findings): {weakest_txt}.",
        f"Strongest areas: {strongest_txt}.",
    ]

    if agents_run < 10:
        lines.insert(
            2,
            f"Coverage: {agents_run} agent(s) run, {agents_with_findings} dimension(s) with findings.",
        )

    if p0_actions:
        lines.append("")
        lines.append(f"Immediate actions required ({len(p0_actions)} critical):")
        for r in p0_actions[:3]:
            lines.append(f"  - {r['title']}: {r['action']}")

    if p1_actions:
        lines.append("")
        lines.append(f"High-priority improvements ({len(p1_actions)}):")
        for r in p1_actions[:3]:
            lines.append(f"  - {r['title']}: {r['action']}")

    return "\n".join(lines)


def _default_dependency_graph() -> dict:
    return {
        "nodes": [
            {"id": "api", "label": "FastAPI Service", "type": "api", "riskLevel": "medium"},
            {"id": "llm", "label": "LLM Runtime", "type": "llm", "riskLevel": "high"},
            {"id": "db", "label": "Application DB", "type": "database", "riskLevel": "medium"},
            {"id": "cache", "label": "Redis Cache", "type": "database", "riskLevel": "low"},
            {"id": "queue", "label": "Task Queue", "type": "queue", "riskLevel": "low"},
            {"id": "vendor", "label": "External Model API", "type": "external", "riskLevel": "high"},
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
    overall_score = compute_overall_score(dimension_scores, all_findings)

    for dim_name, data in all_findings.items():
        data["score"] = dimension_scores.get(dim_name, 100)
        data["summary"] = _generate_summary(dim_name, data)

    augment_risk_findings(all_findings, dimension_scores)

    recommendations = _generate_recommendations(all_findings)
    executive_summary = _generate_executive_summary(
        overall_score,
        dimension_scores,
        all_findings,
        recommendations,
    )

    dep_graph = state.get("dependency_graph", _default_dependency_graph())
    if not isinstance(dep_graph, dict):
        dep_graph = _default_dependency_graph()
    for node in dep_graph.get("nodes", []):
        if "riskLevel" not in node:
            node["riskLevel"] = "medium"

    final_report = {
        "overall_score": overall_score,
        "executive_summary": executive_summary,
        "dimension_scores": dimension_scores,
        "findings": all_findings,
        "dependency_graph": dep_graph,
        "recommendations": recommendations,
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
