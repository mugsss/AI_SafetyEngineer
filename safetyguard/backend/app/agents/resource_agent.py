import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized resource management safety agent.

Look for memory leak patterns (unbounded caches, global lists), connection churn, missing pool limits, file handle leaks, unbounded concurrency, and rate limiting gaps for external APIs or the LLM provider. Cross-check configuration for limits and timeouts.

Use search_code and read_config_files.

Output ONLY a JSON array. Each object:
- "id": "F-001", ...
- "dimension": "resources"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Use [] if none."""


async def resource_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "resource_findings": [],
                "current_agent": "resource_agent",
                "progress": 70,
            }

        tools = AGENT_TOOL_MAP["resources"]
        llm = ChatOpenAI(**settings.get_llm_kwargs()).bind_tools(tools)

        context = (
            f"Repo: {state.get('repo_summary', '')}\n"
            f"Service map: {state.get('service_map', {})}\n"
            f"Components: {state.get('component_summaries', {})}"
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{context}\n\nAnalyze and return JSON array of findings."},
        ]

        for _ in range(settings.AGENT_MAX_TOOL_ROUNDS):
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
            "resource_findings": findings,
            "current_agent": "resource_agent",
            "progress": 70,
        }
    except Exception as e:
        logger.error("resource_agent error: %s", e, exc_info=True)
        return {
            "resource_findings": [],
            "current_agent": "resource_agent",
            "progress": 70,
            "error": str(e),
        }
