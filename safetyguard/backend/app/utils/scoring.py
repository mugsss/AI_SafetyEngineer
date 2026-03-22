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


def _risk_severity_label(risk_severity: float) -> str:
    if risk_severity <= 20:
        return "Low"
    elif risk_severity <= 45:
        return "Medium"
    elif risk_severity <= 70:
        return "High"
    return "Critical"


def augment_risk_findings(all_findings: dict, dimension_scores: dict[str, float]) -> None:
    """Attach risk_safety_score, risk_severity, and severity_label to the risk entry.

    Only the Risk dimension gets these extra fields; all other agents are unchanged.
    risk_safety_score = current score (100 minus penalties, clamped 0-100)
    risk_severity     = 100 - risk_safety_score  (how much safety was lost)
    """
    if "risk" not in all_findings or "risk" not in dimension_scores:
        return
    risk_safety_score = round(dimension_scores["risk"], 1)
    risk_severity = round(100.0 - risk_safety_score, 1)
    all_findings["risk"].update({
        "risk_safety_score": risk_safety_score,
        "risk_severity": risk_severity,
        "severity_label": _risk_severity_label(risk_severity),
    })


def compute_overall_score(dimension_scores: dict[str, float]) -> float:
    """Weighted average only over dimensions that were actually analyzed."""
    total_w = 0.0
    acc = 0.0
    for dim, score in dimension_scores.items():
        w = DIMENSION_WEIGHTS.get(str(dim), 0.0)
        acc += w * float(score)
        total_w += w
    if total_w <= 0:
        return round(100.0, 1)
    return round(acc / total_w, 1)
