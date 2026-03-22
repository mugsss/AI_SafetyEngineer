import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized hallucination and grounding safety agent for LLM applications.

Assess how well outputs are grounded: retrieval or RAG usage, citations, refusal when \
evidence is missing, and whether prompts push the model to invent facts. Look for missing \
validation of model answers against tools or databases, vague system instructions, and \
absence of confidence calibration or source attribution.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to dig deeper. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "hallucinations", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def hallucination_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="hallucinations",
        findings_key="hallucination_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=40,
    )
