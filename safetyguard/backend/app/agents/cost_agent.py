import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized cost and efficiency safety agent for LLM workloads.

Look for unbounded token use: huge prompts, lack of summarization, repeated full-document context, chains without caching, unnecessary model tier usage, polling loops that call the model, and missing batching where obvious from code. Review prompt templates and retrieval patterns.

Use tools to inspect prompts, search for LLM invocation patterns, and read hot paths in code.

Respond with ONLY a JSON array. Each finding:
- "id": "F-001", ...
- "dimension": "cost"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Use [] if nothing to report."""


async def cost_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "cost_findings": [],
                "current_agent": "cost_agent",
                "progress": 50,
            }

        tools = AGENT_TOOL_MAP["cost"]
        llm = ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0).bind_tools(tools)

        context = (
            f"Repo: {state.get('repo_summary', '')}\n"
            f"Service map: {state.get('service_map', {})}\n"
            f"Components: {state.get('component_summaries', {})}"
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{context}\n\nAnalyze and return JSON array of findings."},
        ]

        for _ in range(5):
            response = await llm.ainvoke(messages)
            if not response.tool_calls:
                break
            messages.append(response)
            for tc in response.tool_calls:
                tool_fn = next(t for t in tools if t.name == tc["name"])
                result = tool_fn.invoke(tc["args"])
                messages.append({"role": "tool", "content": str(result), "tool_call_id": tc["id"]})

        try:
            raw = response.content
            if isinstance(raw, list):
                raw = "".join(str(x) for x in raw)
            elif raw is None:
                raw = ""
            findings = json.loads(raw)
            if not isinstance(findings, list):
                findings = []
        except (json.JSONDecodeError, AttributeError, TypeError):
            findings = []

        return {
            "cost_findings": findings,
            "current_agent": "cost_agent",
            "progress": 50,
        }
    except Exception as e:
        logger.error("cost_agent error: %s", e, exc_info=True)
        return {
            "cost_findings": [],
            "current_agent": "cost_agent",
            "progress": 50,
            "error": str(e),
        }
