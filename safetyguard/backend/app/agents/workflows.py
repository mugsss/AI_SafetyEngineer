import asyncio
import logging
from typing import Any

from langgraph.graph import StateGraph, START, END

from app.agents.state import SafetyGuardState
from app.agents.repo_explorer import (
    init_repo_scan,
    explorer_llm,
    explorer_tools,
    should_continue,
)
from app.agents.risk_agent import risk_agent
from app.agents.security_agent import security_agent
from app.agents.hallucination_agent import hallucination_agent
from app.agents.failure_agent import failure_agent
from app.agents.cost_agent import cost_agent
from app.agents.privacy_agent import privacy_agent
from app.agents.observability_agent import observability_agent
from app.agents.performance_agent import performance_agent
from app.agents.resource_agent import resource_agent
from app.agents.redteam_agent import redteam_agent
from app.agents.synthesis_agent import synthesis_agent

logger = logging.getLogger(__name__)


def build_repo_understanding_graph() -> StateGraph:
    graph = StateGraph(SafetyGuardState)

    graph.add_node("init_repo_scan", init_repo_scan)
    graph.add_node("explorer_llm", explorer_llm)
    graph.add_node("explorer_tools", explorer_tools)

    graph.add_edge(START, "init_repo_scan")
    graph.add_edge("init_repo_scan", "explorer_llm")
    graph.add_conditional_edges(
        "explorer_llm",
        should_continue,
        {"continue": "explorer_tools", "end": END},
    )
    graph.add_edge("explorer_tools", "explorer_llm")

    return graph


AGENT_NODES = {
    "risk": risk_agent,
    "security": security_agent,
    "hallucinations": hallucination_agent,
    "failures": failure_agent,
    "cost": cost_agent,
    "privacy": privacy_agent,
    "observability": observability_agent,
    "performance": performance_agent,
    "resources": resource_agent,
    "redteam": redteam_agent,
}


def _load_inputs(state: SafetyGuardState) -> dict:
    return {
        "status": "running",
        "progress": 0,
        "current_agent": "load_inputs",
        "risk_findings": [],
        "security_findings": [],
        "hallucination_findings": [],
        "failure_findings": [],
        "cost_findings": [],
        "privacy_findings": [],
        "observability_findings": [],
        "performance_findings": [],
        "resource_findings": [],
        "redteam_findings": [],
        "custom_findings_map": state.get("custom_findings_map") or {},
    }


def _repo_understanding(state: SafetyGuardState) -> dict:
    repo_graph = build_repo_understanding_graph().compile()
    result = repo_graph.invoke(state)
    return {
        "repo_summary": result.get("repo_summary", ""),
        "file_index": result.get("file_index", []),
        "service_map": result.get("service_map", {}),
        "component_summaries": result.get("component_summaries", {}),
        "progress": 15,
        "current_agent": "repo_understanding",
    }


MAX_CONCURRENT_AGENTS = 1


def _make_custom_runner(spec: dict, progress: int):
    from app.agents._agent_base import run_custom_dimension_agent

    async def _run(state_inner: SafetyGuardState) -> dict:
        return await run_custom_dimension_agent(
            slug=str(spec["slug"]),
            display_name=str(spec.get("display_name") or spec["slug"]),
            base_dimension=str(spec["base_dimension"]),
            system_prompt=str(spec["system_prompt"]),
            state=state_inner,
            progress=progress,
        )

    return _run


async def _dispatch_agents(state: SafetyGuardState) -> dict:
    """Run enabled dimension agents on the current event loop (no nested asyncio.run)."""
    enabled = state.get("enabled_agents", {})
    agent_pairs: list[tuple[str, Any]] = [
        (name, fn) for name, fn in AGENT_NODES.items()
        if enabled.get(name, False)
    ]

    custom_specs = state.get("custom_agents") or []
    for i, spec in enumerate(custom_specs):
        slug = spec.get("slug")
        if not slug:
            continue
        key = f"custom_{slug}"
        if not enabled.get(key, False):
            continue
        progress = min(78, 32 + i * 9)
        agent_pairs.append((key, _make_custom_runner(spec, progress)))

    if not agent_pairs:
        return {"progress": 80}

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_AGENTS)

    async def _throttled(name: str, fn):
        async with semaphore:
            return await fn(state)

    results = await asyncio.gather(
        *[_throttled(name, fn) for name, fn in agent_pairs],
        return_exceptions=True,
    )

    merged: dict = {"progress": 80}
    custom_map: dict[str, list] = {}
    for r in results:
        if isinstance(r, BaseException):
            logger.warning("Dimension agent failed: %s", r)
            continue
        if not isinstance(r, dict):
            continue
        cm = r.get("custom_findings_map")
        if isinstance(cm, dict):
            custom_map.update(cm)
        for k, v in r.items():
            if k == "custom_findings_map":
                continue
            merged[k] = v
    if custom_map:
        merged["custom_findings_map"] = custom_map

    return merged


def build_safety_analysis_graph() -> StateGraph:
    graph = StateGraph(SafetyGuardState)

    graph.add_node("load_inputs", _load_inputs)
    graph.add_node("repo_understanding", _repo_understanding)
    graph.add_node("dispatch_agents", _dispatch_agents)
    graph.add_node("synthesis", synthesis_agent)

    graph.add_edge(START, "load_inputs")
    graph.add_edge("load_inputs", "repo_understanding")
    graph.add_edge("repo_understanding", "dispatch_agents")
    graph.add_edge("dispatch_agents", "synthesis")
    graph.add_edge("synthesis", END)

    return graph
