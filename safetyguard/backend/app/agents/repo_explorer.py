"""LangGraph-oriented repo exploration nodes (repo understanding agent)."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from typing import Any, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import ToolNode

from app.agents.state import SafetyGuardState
from app.config import settings
from app.utils.file_tools import ALL_TOOLS, get_dependency_info, get_repo_metadata, list_files, set_repo_root

_EXPLORER_SYSTEM = (
    "You are a code repository analyst. Examine the repository to understand its "
    "architecture, services, and components. Use tools to explore files selectively."
)

_EXPLORER_JSON_INSTRUCTION = (
    "When you are done using tools, respond with a single JSON object in a markdown "
    'fenced block with language tag json, containing keys: '
    '"repo_summary" (string), "service_map" (object mapping service or area names to '
    'short descriptions), and "component_summaries" (object mapping component names to '
    "short descriptions). Do not omit these keys in your final answer."
)

_EXPLORER_TOOL_NODE = ToolNode(ALL_TOOLS)


def init_repo_scan(state: SafetyGuardState) -> dict[str, Any]:
    """Set repo root and collect an initial file list and metadata overview."""
    repo_path = state.get("repo_path") or "."
    set_repo_root(repo_path)

    listing = list_files.invoke("")
    file_index = [p.strip() for p in listing.splitlines() if p.strip() and not p.startswith("Error")]

    meta = get_repo_metadata.invoke("")
    deps = get_dependency_info.invoke("")
    repo_summary = (
        "Initial repository scan\n\n"
        f"--- Metadata ---\n{meta}\n\n"
        f"--- Dependencies ---\n{deps}\n\n"
        f"--- File listing (truncated in tool output) ---\n{listing[:8000]}"
    )

    return {
        "file_index": file_index,
        "repo_summary": repo_summary,
        "progress": 5,
        "current_agent": "repo_explorer",
        "status": "running",
    }


def _mock_from_file_index(file_index: list[str]) -> tuple[str, dict[str, str], dict[str, str]]:
    """Build plausible summaries from paths when LLM is unavailable."""
    if not file_index:
        return (
            "Mock mode: no files were listed for this repository.",
            {},
            {},
        )

    by_top: dict[str, list[str]] = defaultdict(list)
    ext_counts: dict[str, int] = defaultdict(int)
    for rel in file_index:
        top = rel.split("/", 1)[0] if "/" in rel else "(root)"
        by_top[top].append(rel)
        ext = rel.rsplit(".", 1)[-1] if "." in rel.split("/")[-1] else ""
        ext_counts[ext or "(no ext)"] += 1

    top_exts = sorted(ext_counts.items(), key=lambda x: x[1], reverse=True)[:8]
    ext_line = ", ".join(f"{e}: {c}" for e, c in top_exts)

    areas = sorted(by_top.keys())[:12]
    service_map: dict[str, str] = {}
    for area in areas:
        n = len(by_top[area])
        sample = by_top[area][:3]
        hint = ", ".join(s.split("/")[-1] for s in sample)
        service_map[area] = f"~{n} files; examples: {hint}"

    component_summaries: dict[str, str] = {}
    for name in ("layout", "configuration", "dependencies", "tests"):
        if name == "dependencies":
            component_summaries[name] = "Inferred from dependency manifest files when present."
        elif name == "tests":
            hits = [p for p in file_index if "test" in p.lower() or "/tests/" in p.replace("\\", "/")]
            component_summaries[name] = (
                f"Found {len(hits)} likely test-related paths." if hits else "No obvious test paths in index."
            )
        elif name == "configuration":
            cfg = [p for p in file_index if any(x in p.lower() for x in ("config", "docker", "yaml", "yml", "toml"))]
            component_summaries[name] = (
                f"{len(cfg)} paths suggest configuration or infra-related files."
                if cfg
                else "No strong configuration path pattern in file index."
            )
        else:
            component_summaries[name] = f"Derived from top-level areas: {', '.join(areas[:6])}."

    repo_summary = (
        f"[Mock] Repository overview built from {len(file_index)} indexed paths. "
        f"Top-level areas: {', '.join(areas)}. "
        f"Common extensions: {ext_line}."
    )

    return repo_summary, service_map, component_summaries


def _extract_json_block(text: str) -> dict[str, Any] | None:
    """Parse ```json ... ``` or bare JSON object from model output."""
    if not text:
        return None
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = fence.group(1).strip() if fence else text.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    # Try to find outermost {...}
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            return None
    return None


def explorer_llm(state: SafetyGuardState) -> dict[str, Any]:
    """Either mock structured output from the file index or call OpenAI with tools."""
    if settings.is_mock_mode:
        file_index = state.get("file_index") or []
        repo_summary, service_map, component_summaries = _mock_from_file_index(file_index)
        return {
            "repo_summary": repo_summary,
            "service_map": service_map,
            "component_summaries": component_summaries,
        }

    llm = ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0).bind_tools(ALL_TOOLS)

    prior = list(state.get("messages") or [])
    if not prior:
        file_index = state.get("file_index") or []
        idx_preview = "\n".join(file_index[:400])
        if len(file_index) > 400:
            idx_preview += f"\n... ({len(file_index) - 400} more paths)"
        human = HumanMessage(
            content=(
                f"Repository path: {state.get('repo_path', '')}\n\n"
                f"{_EXPLORER_JSON_INSTRUCTION}\n\n"
                "Initial scan summary:\n"
                f"{state.get('repo_summary', '')}\n\n"
                "File index:\n"
                f"{idx_preview}"
            )
        )
        prior = [SystemMessage(content=_EXPLORER_SYSTEM), human]

    response = llm.invoke(prior)
    if not isinstance(response, AIMessage):
        response = AIMessage(content=str(response))

    out: dict[str, Any] = {"explorer_turns": state.get("explorer_turns", 0) + 1}
    if not state.get("messages"):
        out["messages"] = prior + [response]
    else:
        out["messages"] = [response]

    if not response.tool_calls:
        parsed = _extract_json_block(response.content or "")
        if parsed:
            out["repo_summary"] = str(parsed.get("repo_summary", state.get("repo_summary", "")))
            sm = parsed.get("service_map")
            out["service_map"] = sm if isinstance(sm, dict) else state.get("service_map", {})
            cs = parsed.get("component_summaries")
            out["component_summaries"] = (
                {str(k): str(v) for k, v in cs.items()} if isinstance(cs, dict) else state.get("component_summaries", {})
            )
        else:
            out["repo_summary"] = response.content or state.get("repo_summary", "")
            out.setdefault("service_map", state.get("service_map", {}))
            out.setdefault("component_summaries", state.get("component_summaries", {}))

    return out


def explorer_tools(state: SafetyGuardState) -> dict[str, Any]:
    """Run pending tool calls from the last assistant message (LangGraph ToolNode)."""
    return _EXPLORER_TOOL_NODE.invoke(state)


def should_continue(state: SafetyGuardState) -> Literal["end", "continue"]:
    """Route: more tool rounds vs. finish exploration."""
    if settings.is_mock_mode:
        return "end"

    if state.get("explorer_turns", 0) >= 20:
        return "end"

    messages = state.get("messages") or []
    if not messages:
        return "end"

    last = messages[-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "continue"
    return "end"
