import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized observability safety agent for LLM services.

Assess logging (structured vs ad hoc), tracing hooks (OpenTelemetry or similar), metrics for latency and errors, and alerting signals. Flag silent failures, missing request/ correlation IDs, logging of prompts without policy, and absence of health or dependency checks in config/code where applicable.

Use read_config_files, search_code, and read_file to verify practices.

Output ONLY a JSON array. Each finding object:
- "id": "F-001", ...
- "dimension": "observability"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Use [] if nothing stands out."""


async def observability_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "observability_findings": [],
                "current_agent": "observability_agent",
                "progress": 60,
            }

        tools = AGENT_TOOL_MAP["observability"]
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
            "observability_findings": findings,
            "current_agent": "observability_agent",
            "progress": 60,
        }
    except Exception as e:
        logger.error("observability_agent error: %s", e, exc_info=True)
        return {
            "observability_findings": [],
            "current_agent": "observability_agent",
            "progress": 60,
            "error": str(e),
        }
