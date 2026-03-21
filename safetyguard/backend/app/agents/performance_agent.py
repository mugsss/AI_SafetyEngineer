import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized performance and latency safety agent.

Identify likely bottlenecks: synchronous blocking calls in async code, N+1 patterns, large payloads moved on every request, missing streaming where user-facing latency matters, absence of connection pooling configuration, and expensive operations on the critical path before streaming starts.

Use search_code and read_file to inspect hot paths and integration code.

Respond with ONLY a JSON array. Each finding:
- "id": "F-001", ...
- "dimension": "performance"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Return [] if no findings."""


async def performance_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "performance_findings": [],
                "current_agent": "performance_agent",
                "progress": 65,
            }

        tools = AGENT_TOOL_MAP["performance"]
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
            "performance_findings": findings,
            "current_agent": "performance_agent",
            "progress": 65,
        }
    except Exception as e:
        logger.error("performance_agent error: %s", e, exc_info=True)
        return {
            "performance_findings": [],
            "current_agent": "performance_agent",
            "progress": 65,
            "error": str(e),
        }
