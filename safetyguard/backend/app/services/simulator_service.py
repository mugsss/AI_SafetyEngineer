from app.config import settings


async def simulate_failure(
    dependency_graph: dict,
    node_id: str,
    failure_type: str,
) -> dict:
    nodes = dependency_graph.get("nodes", [])
    edges = dependency_graph.get("edges", [])

    target_node = None
    for n in nodes:
        if n.get("id") == node_id:
            target_node = n
            break

    if not target_node:
        return {
            "impacted_nodes": [],
            "narrative": f"Node {node_id} not found in dependency graph.",
            "dimension_impacts": {},
        }

    impacted = set()
    queue = [node_id]
    while queue:
        current = queue.pop(0)
        for edge in edges:
            if edge.get("source") == current:
                target = edge.get("target")
                if target and target not in impacted:
                    impacted.add(target)
                    queue.append(target)

    severity_map = {
        "full_outage": 1.0,
        "high_latency": 0.6,
        "partial_degradation": 0.3,
    }
    severity = severity_map.get(failure_type, 0.5)

    dimension_impacts = {}
    if len(impacted) > 0:
        dimension_impacts["failures"] = -15 * severity
        dimension_impacts["performance"] = -10 * severity
        dimension_impacts["risk"] = -8 * severity

    failure_label = failure_type.replace("_", " ")
    narrative = (
        f"Simulating {failure_label} of '{target_node.get('label', node_id)}': "
        f"{len(impacted)} downstream components would be affected. "
    )
    if failure_type == "full_outage":
        narrative += "Complete service disruption expected for dependent components."
    elif failure_type == "high_latency":
        narrative += "Significant latency increase propagating through the dependency chain."
    else:
        narrative += "Partial degradation with reduced throughput in downstream services."

    if not settings.is_mock_mode:
        try:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0)
            result = await llm.ainvoke(
                f"In 2-3 sentences, describe the impact of a {failure_label} "
                f"on component '{target_node.get('label', node_id)}' "
                f"affecting {len(impacted)} downstream components: {list(impacted)}"
            )
            narrative = result.content
        except Exception:
            pass

    return {
        "impacted_nodes": list(impacted),
        "narrative": narrative,
        "dimension_impacts": dimension_impacts,
    }
