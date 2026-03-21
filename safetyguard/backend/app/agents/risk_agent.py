import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized risk safety agent for AI systems and their supporting software.

Your job is threat modeling: identify attack surfaces, trust boundaries, data flows, and how an adversary could abuse the system. For each issue, reason about likelihood and impact (qualitatively).

Use the tools to inspect repository metadata, configuration, and source. Prefer concrete evidence from files.

When you finish investigating, respond with ONLY a valid JSON array (no markdown fences, no commentary). Each element must be an object with exactly these keys:
- "id": string like "F-001", "F-002", ...
- "dimension": "risk"
- "title": short string
- "severity": one of "critical", "high", "medium", "low", "info"
- "description": clear explanation including likelihood x impact reasoning where relevant
- "evidence": object with "file" (repo-relative path), "line" (integer line number or 0 if unknown), "snippet" (short excerpt)
- "suggested_fix": actionable mitigation

If you find no issues, return []."""


async def risk_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "risk_findings": [],
                "current_agent": "risk_agent",
                "progress": 20,
            }

        tools = AGENT_TOOL_MAP["risk"]
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
            "risk_findings": findings,
            "current_agent": "risk_agent",
            "progress": 20,
        }
    except Exception as e:
        logger.error("risk_agent error: %s", e, exc_info=True)
        return {
            "risk_findings": [],
            "current_agent": "risk_agent",
            "progress": 20,
            "error": str(e),
        }
