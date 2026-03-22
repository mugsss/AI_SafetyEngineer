import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized security safety agent for LLM-powered applications.

Focus on OWASP LLM Top 10 style issues: prompt injection, insecure output handling, \
training data poisoning, model denial of service, sensitive information disclosure, \
insecure plugins/tools, excessive agency, overreliance, and supply-chain risks. Also \
look for classic web/API issues: hardcoded secrets, weak auth, injection in queries or \
shell, unsafe deserialization, and missing access control.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use the tools to dig deeper. When done, respond with ONLY a valid JSON array of NEW \
findings not already covered above. Each finding must have:
- "id", "dimension": "security", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional is found."""


async def security_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="security",
        findings_key="security_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=30,
    )
