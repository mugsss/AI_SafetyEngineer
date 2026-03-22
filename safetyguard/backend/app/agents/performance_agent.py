import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized performance and latency safety agent.

Identify bottlenecks: synchronous blocking calls in async code, N+1 patterns, large \
payloads on every request, missing streaming for user-facing latency, absence of \
connection pooling, and expensive operations on the critical path.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to inspect hot paths. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "performance", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def performance_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="performance",
        findings_key="performance_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=65,
    )
