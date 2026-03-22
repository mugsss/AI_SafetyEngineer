import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized reliability and failure-mode safety agent.

Focus on single points of failure, missing retries, absent timeouts, lack of circuit \
breakers around LLM and external calls, error swallowing, and unsafe fallbacks. Check \
configuration for production resilience.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to dig deeper. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "failures", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def failure_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="failures",
        findings_key="failure_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=45,
    )
