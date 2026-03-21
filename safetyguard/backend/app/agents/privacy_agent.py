import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized privacy and data protection safety agent.

Focus on PII flowing into prompts, logs, or analytics without minimization; lack of redaction; training or fine-tuning on user data without safeguards; GDPR-style concerns when evident (retention, purpose limitation) from code and configs; and secrets mistaken for non-sensitive data.

You only have search_code and read_file—use them efficiently to locate logging, analytics, and data pipelines.

Return ONLY a JSON array. Each finding:
- "id": "F-001", ...
- "dimension": "privacy"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Return [] if no issues."""


async def privacy_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "privacy_findings": [],
                "current_agent": "privacy_agent",
                "progress": 55,
            }

        tools = AGENT_TOOL_MAP["privacy"]
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
            "privacy_findings": findings,
            "current_agent": "privacy_agent",
            "progress": 55,
        }
    except Exception as e:
        logger.error("privacy_agent error: %s", e, exc_info=True)
        return {
            "privacy_findings": [],
            "current_agent": "privacy_agent",
            "progress": 55,
            "error": str(e),
        }
