import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized privacy and data protection safety agent.

Focus on PII flowing into prompts, logs, or analytics without minimization; lack of \
redaction; training on user data without safeguards; GDPR-style retention and purpose \
limitation concerns; and secrets mistaken for non-sensitive data.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to locate logging, analytics, and data pipelines. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "privacy", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def privacy_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="privacy",
        findings_key="privacy_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=55,
    )
