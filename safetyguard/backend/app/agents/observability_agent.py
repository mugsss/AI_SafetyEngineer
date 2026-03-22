import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized observability safety agent for LLM services.

Assess logging (structured vs ad hoc), tracing hooks (OpenTelemetry or similar), metrics \
for latency and errors, and alerting signals. Flag silent failures, missing correlation \
IDs, logging of prompts without policy, and absence of health/dependency checks.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to verify practices. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "observability", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def observability_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="observability",
        findings_key="observability_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=60,
    )
