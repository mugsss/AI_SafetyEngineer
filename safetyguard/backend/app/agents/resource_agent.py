import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized resource management safety agent.

Look for memory leak patterns (unbounded caches, global lists), connection churn, missing \
pool limits, file handle leaks, unbounded concurrency, and rate limiting gaps for external \
APIs or the LLM provider. Cross-check configuration for limits and timeouts.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to verify. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "resources", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def resource_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="resources",
        findings_key="resource_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=70,
    )
