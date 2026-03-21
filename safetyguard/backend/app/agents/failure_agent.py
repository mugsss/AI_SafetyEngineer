import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized reliability and failure-mode safety agent.

Focus on single points of failure, missing retries, absent timeouts, lack of circuit breakers or bulkheads around LLM and external calls, error swallowing, and unsafe fallbacks. Check configuration for production resilience (replicas, health checks, queues) when visible in repo files.

Use tools to read configs and trace code paths for external dependencies and error handling.

Output ONLY a JSON array. Each object:
- "id": "F-001", ...
- "dimension": "failures"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Return [] if none."""


async def failure_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "failure_findings": [],
                "current_agent": "failure_agent",
                "progress": 45,
            }

        tools = AGENT_TOOL_MAP["failures"]
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
            "failure_findings": findings,
            "current_agent": "failure_agent",
            "progress": 45,
        }
    except Exception as e:
        logger.error("failure_agent error: %s", e, exc_info=True)
        return {
            "failure_findings": [],
            "current_agent": "failure_agent",
            "progress": 45,
            "error": str(e),
        }
