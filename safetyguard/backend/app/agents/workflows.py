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


async def _run_agents_parallel(state: SafetyGuardState) -> dict:
    import asyncio

    enabled = state.get("enabled_agents", {})
    tasks = []
    for agent_name, agent_fn in AGENT_NODES.items():
        if enabled.get(agent_name, False):
            tasks.append(agent_fn(state))

    if not tasks:
        return {"progress": 80}

    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: dict = {"progress": 80}
    for r in results:
        if isinstance(r, dict):
            merged.update(r)

    return merged


def _dispatch_agents(state: SafetyGuardState) -> dict:
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(
                asyncio.run, _run_agents_parallel(state)
            ).result()
        return result
    else:
        return asyncio.run(_run_agents_parallel(state))


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
