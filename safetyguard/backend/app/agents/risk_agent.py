import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized risk safety agent for AI systems and their supporting software.

Perform threat modeling: identify attack surfaces, trust boundaries, data flows, and \
how an adversary could abuse the system. Reason about likelihood and impact.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use the tools to find concrete evidence. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "risk", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def risk_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="risk",
        findings_key="risk_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=20,
    )
