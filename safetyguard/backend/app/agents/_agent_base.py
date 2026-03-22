"""Shared logic for dimension agents: static analysis + optional LLM enhancement."""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import ChatOpenAI

from app.config import settings
from app.utils.file_tools import AGENT_TOOL_MAP
from app.utils.static_analyzers import run_static_analysis

logger = logging.getLogger(__name__)


def merge_findings(static: list[dict], llm: list[dict]) -> list[dict]:
    """Combine static and LLM findings, deduplicating by title similarity."""
    seen = {f.get("title", "").lower().strip() for f in static}
    merged = list(static)
    for f in llm:
        title = f.get("title", "").lower().strip()
        if title and title not in seen:
            seen.add(title)
            merged.append(f)
    return merged


async def run_dimension_agent(
    *,
    dimension: str,
    findings_key: str,
    system_prompt: str,
    state: dict[str, Any],
    progress: int,
) -> dict[str, Any]:
    """Run a dimension agent: static analysis first, then LLM if available.

    Parameters
    ----------
    dimension : e.g. "security", "hallucinations"
    findings_key : state key, e.g. "security_findings"
    system_prompt : the prompt template (may contain ``{static_summary}``)
    state : current SafetyGuardState
    progress : integer progress to report
    """
    agent_name = f"{dimension}_agent"
    repo_path = state.get("repo_path", ".")
    static_findings = run_static_analysis(repo_path, dimension)

    if settings.is_mock_mode:
        return {
            findings_key: static_findings,
            "current_agent": agent_name,
            "progress": progress,
        }

    # LLM enhancement
    try:
        tools = AGENT_TOOL_MAP.get(dimension, [])
        llm = ChatOpenAI(**settings.get_llm_kwargs())
        if tools:
            llm = llm.bind_tools(tools)

        static_summary = "\n".join(
            f"- [{f['severity']}] {f['title']}: {f['description'][:120]}"
            for f in static_findings[:10]
        ) or "(none)"

        context = (
            f"Repo: {state.get('repo_summary', '')}\n"
            f"Service map: {state.get('service_map', {})}\n"
            f"Components: {state.get('component_summaries', {})}"
        )

        prompt = system_prompt
        if "{static_summary}" in prompt:
            prompt = prompt.format(static_summary=static_summary)

        messages: list[dict[str, str] | Any] = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{context}\n\nAnalyze and return a JSON array of NEW findings beyond the static analysis."},
        ]

        for _ in range(5):
            response = await llm.ainvoke(messages)
            if not response.tool_calls:
                break
            messages.append(response)
            for tc in response.tool_calls:
                tool_fn = next(
                    (t for t in tools if t.name == tc.get("name")),
                    None,
                )
                if tool_fn is None:
                    logger.warning(
                        "%s: LLM requested unknown tool %r; skipping.",
                        agent_name,
                        tc.get("name"),
                    )
                    continue
                result = tool_fn.invoke(tc["args"])
                messages.append({
                    "role": "tool",
                    "content": str(result),
                    "tool_call_id": tc["id"],
                })

        raw = response.content
        if isinstance(raw, list):
            raw = "".join(str(x) for x in raw)
        elif raw is None:
            raw = ""
        llm_findings = json.loads(raw)
        if not isinstance(llm_findings, list):
            llm_findings = []
    except Exception as e:
        logger.warning("%s LLM pass failed, using static only: %s", agent_name, e)
        llm_findings = []

    return {
        findings_key: merge_findings(static_findings, llm_findings),
        "current_agent": agent_name,
        "progress": progress,
    }
