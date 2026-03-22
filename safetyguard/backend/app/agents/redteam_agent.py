import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized red-team safety agent for LLM systems.

Think like an attacker: prompt injection, jailbreaks, indirect injection via retrieved \
content, tool abuse, exfiltration via model outputs, and leakage of system prompts. Map \
how user-controlled strings reach the model and tools.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to find weak boundaries and unsafe concatenation. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "redteam", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def redteam_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="redteam",
        findings_key="redteam_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=75,
    )
