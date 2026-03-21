import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized red-team safety agent for LLM systems.

Think like an attacker: prompt injection, jailbreaks, indirect injection via retrieved content, tool abuse, exfiltration via model outputs, and leakage of system prompts or internal instructions. Map how user-controlled strings reach the model and tools.

Use read_prompt_templates, search_code, and read_file to find weak boundaries and unsafe concatenation.

Respond with ONLY a JSON array. Each finding:
- "id": "F-001", ...
- "dimension": "redteam"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Return [] if no exploitable patterns are evident from the repository."""


async def redteam_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "redteam_findings": [],
                "current_agent": "redteam_agent",
                "progress": 75,
            }

        tools = AGENT_TOOL_MAP["redteam"]
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
            "redteam_findings": findings,
            "current_agent": "redteam_agent",
            "progress": 75,
        }
    except Exception as e:
        logger.error("redteam_agent error: %s", e, exc_info=True)
        return {
            "redteam_findings": [],
            "current_agent": "redteam_agent",
            "progress": 75,
            "error": str(e),
        }
