import logging

from app.agents.state import SafetyGuardState
from app.agents._agent_base import run_dimension_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a specialized cost and efficiency safety agent for LLM workloads.

Look for unbounded token use, huge prompts, lack of summarization, repeated full-document \
context, chains without caching, unnecessary model tier usage, polling loops that call the \
model, and missing batching. Review prompt templates and retrieval patterns.

A static analysis pass already identified these issues (do NOT duplicate them):
{static_summary}

Use tools to inspect prompts and hot paths. Respond with ONLY a valid JSON array of NEW findings. Each must have:
- "id", "dimension": "cost", "title", "severity", "description"
- "evidence": {{"file": "...", "line": N, "snippet": "..."}}
- "suggested_fix"

Return [] if nothing additional."""


async def cost_agent(state: SafetyGuardState) -> dict:
    return await run_dimension_agent(
        dimension="cost",
        findings_key="cost_findings",
        system_prompt=SYSTEM_PROMPT,
        state=state,
        progress=50,
    )
