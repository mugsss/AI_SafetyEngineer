import json
import logging

from langchain_openai import ChatOpenAI

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a specialized security safety agent for LLM-powered applications.

Focus on OWASP LLM Top 10 style issues: prompt injection, insecure output handling, training data poisoning, model denial of service, sensitive information disclosure, insecure plugins/tools, excessive agency, overreliance, and supply-chain risks. Also look for classic web/API issues in this codebase: hardcoded secrets, weak auth, injection in queries or shell, unsafe deserialization, and missing access control on sensitive operations.

Use the tools to search code, read relevant files, inspect environment variable usage patterns (redacted keys only), and review OpenAPI exposure.

When done, respond with ONLY a valid JSON array (no markdown, no extra text). Each finding object must have:
- "id": "F-001", etc.
- "dimension": "security"
- "title", "severity" (critical|high|medium|low|info), "description"
- "evidence": {"file": "...", "line": N, "snippet": "..."}
- "suggested_fix": string

Return [] if nothing substantive is found."""


async def security_agent(state: SafetyGuardState) -> dict:
    try:
        if settings.is_mock_mode:
            return {
                "security_findings": [],
                "current_agent": "security_agent",
                "progress": 30,
            }

        tools = AGENT_TOOL_MAP["security"]
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
            "security_findings": findings,
            "current_agent": "security_agent",
            "progress": 30,
        }
    except Exception as e:
        logger.error("security_agent error: %s", e, exc_info=True)
        return {
            "security_findings": [],
            "current_agent": "security_agent",
            "progress": 30,
            "error": str(e),
        }
