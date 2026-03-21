import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized hallucination and grounding safety agent for LLM applications.

Assess how well outputs are grounded: retrieval or RAG usage, citations, refusal when evidence is missing, and whether prompts push the model to invent facts. Look for missing validation of model answers against tools or databases, vague system instructions, and absence of confidence calibration or source attribution.

Use tools to read prompt templates, compare API contracts in OpenAPI specs to what prompts claim, and search code for grounding-related patterns.

Respond with ONLY a valid JSON array. Each finding must include:
- "id": "F-001", ...
- "dimension": "hallucinations"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix"

Use [] if there are no findings."""


async def hallucination_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "hallucination_findings": [],
                "current_agent": "hallucination_agent",
                "progress": 40,
            }

        tools = AGENT_TOOL_MAP["hallucinations"]
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
            "hallucination_findings": findings,
            "current_agent": "hallucination_agent",
            "progress": 40,
        }
    except Exception as e:
        logger.error("hallucination_agent error: %s", e, exc_info=True)
        return {
            "hallucination_findings": [],
            "current_agent": "hallucination_agent",
            "progress": 40,
            "error": str(e),
        }
