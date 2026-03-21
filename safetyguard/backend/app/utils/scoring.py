"""Dimension and overall score computation for SafetyGuard reports."""

from __future__ import annotations

DIMENSION_WEIGHTS = {
    "security": 0.20,
    "risk": 0.18,
    "hallucinations": 0.15,
    "privacy": 0.12,
    "failures": 0.10,
    "observability": 0.08,
    "performance": 0.07,
    "cost": 0.05,
    "resources": 0.03,
    "redteam": 0.02,
}

SEVERITY_PENALTIES = {
    "critical": 25,
    "high": 12,
    "medium": 5,
    "low": 2,
    "info": 0,
}


def compute_dimension_scores(all_findings: dict) -> dict[str, float]:
    """Start each dimension at 100 and subtract penalties per finding by severity."""
    scores: dict[str, float] = {}
    for dim_name, data in all_findings.items():
        raw = 100.0
        findings = data.get("findings") if isinstance(data, dict) else []
        if not isinstance(findings, list):
            findings = []
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            sev = str(finding.get("severity", "info")).lower()
            raw -= float(SEVERITY_PENALTIES.get(sev, 0))
        clamped = max(0.0, min(100.0, raw))
        scores[str(dim_name)] = clamped
    return scores


def compute_overall_score(dimension_scores: dict[str, float]) -> float:
    """Weighted average of dimension scores using DIMENSION_WEIGHTS."""
    total_w = 0.0
    acc = 0.0
    for dim, w in DIMENSION_WEIGHTS.items():
        score = float(dimension_scores.get(dim, 100.0))
        acc += w * score
        total_w += w
    if total_w <= 0:
        return round(100.0, 1)
    return round(acc / total_w, 1)
