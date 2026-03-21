"""Safe severity ordering for findings (avoids ValueError on unknown labels)."""

SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")


def severity_rank(sev: str | None) -> int:
    s = (sev or "info").strip().lower()
    try:
        return SEVERITY_ORDER.index(s)
    except ValueError:
        return len(SEVERITY_ORDER) - 1


def canonical_severity(sev: str | None) -> str:
    """Map arbitrary labels to a known severity string."""
    s = (sev or "info").strip().lower()
    if s in SEVERITY_ORDER:
        return s
    return "info"
