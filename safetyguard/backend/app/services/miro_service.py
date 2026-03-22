"""Miro board builder: visualizes the SafetyGuard agent workflow and findings."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

MIRO_API = "https://api.miro.com/v2"

_SEVERITY_COLORS = {
    "critical": "#F24726",
    "high": "#FF6B35",
    "medium": "#FAC710",
    "low": "#8FD14F",
    "info": "#9CACBC",
}

_NODE_TYPE_COLORS = {
    "llm": "#7B68EE",
    "api": "#4262FF",
    "database": "#12CDD4",
    "queue": "#FF9D48",
    "external": "#F24726",
}

_PIPELINE_STEPS = [
    ("load_inputs", "Load Inputs"),
    ("repo_understanding", "Repo Understanding"),
    ("dispatch_agents", "Dispatch Agents"),
    ("synthesis", "Synthesis"),
]

_DIMENSION_LABELS = {
    "risk": "Risk",
    "security": "Security",
    "hallucinations": "Hallucinations",
    "failures": "Failures",
    "cost": "Cost",
    "privacy": "Privacy",
    "observability": "Observability",
    "performance": "Performance",
    "resources": "Resources",
    "redteam": "Red Team",
}


def _safe_board_name(repo_url: str, run_id: str) -> str:
    """Generate a compact ASCII board name accepted by Miro."""
    label = (repo_url or run_id).replace("\r", " ").replace("\n", " ").strip()
    if len(label) > 90:
        label = f"{label[:87]}..."
    return f"SafetyGuard - {label}"


def _headers() -> dict[str, str]:
    token = (settings.MIRO_ACCESS_TOKEN or "").strip().strip('"').strip("'")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _rate_limit_pause() -> None:
    time.sleep(0.12)


def _raise_for_status_with_details(
    resp: httpx.Response,
    *,
    action: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Raise a readable error that includes Miro response details."""
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        body_preview = (exc.response.text or "").strip()
        if len(body_preview) > 700:
            body_preview = f"{body_preview[:700]}..."
        logger.error(
            "Miro %s failed: %s %s payload=%s response=%s",
            action,
            exc.request.method,
            exc.request.url,
            payload,
            body_preview,
        )
        raise RuntimeError(
            f"{exc.request.method} {exc.request.url} failed "
            f"({exc.response.status_code}): {body_preview or 'No response body'}"
        ) from exc


async def create_board_for_run(
    run_id: str,
    repo_url: str,
    report: dict[str, Any],
) -> dict[str, str]:
    """Create a Miro board visualizing the agent workflow and findings.

    Returns {"board_id": ..., "board_url": ...}.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        board = await _create_board(client, run_id, repo_url)
        board_id = board["id"]
        board_url = board["viewLink"]

        shape_ids: dict[str, str] = {}

        shape_ids.update(
            await _draw_pipeline(client, board_id)
        )

        shape_ids.update(
            await _draw_agents(client, board_id, report)
        )

        dep_graph = report.get("dependency_graph", {})
        if dep_graph.get("nodes"):
            shape_ids.update(
                await _draw_dependency_graph(client, board_id, dep_graph)
            )

        await _draw_findings_summary(client, board_id, report)

    return {"board_id": board_id, "board_url": board_url}


async def _create_board(
    client: httpx.AsyncClient,
    run_id: str,
    repo_url: str,
) -> dict:
    body = {
        "name": _safe_board_name(repo_url, run_id),
        "description": f"AI Safety analysis workflow for run {run_id}",
    }
    resp = await client.post(f"{MIRO_API}/boards", headers=_headers(), json=body)
    _raise_for_status_with_details(resp, action="board creation", payload=body)
    return resp.json()


async def _add_shape(
    client: httpx.AsyncClient,
    board_id: str,
    *,
    content: str,
    x: float,
    y: float,
    width: float = 200,
    height: float = 80,
    shape: str = "round_rectangle",
    fill_color: str = "#2D2D2D",
    border_color: str = "#4262FF",
    font_size: str = "14",
) -> str:
    """Create a shape and return its item ID."""
    body: dict[str, Any] = {
        "data": {"content": content, "shape": shape},
        "style": {
            "fillColor": fill_color,
            "borderColor": border_color,
            "borderWidth": "2",
            "fontSize": font_size,
            "textAlign": "center",
        },
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width, "height": height},
    }
    _rate_limit_pause()
    resp = await client.post(
        f"{MIRO_API}/boards/{board_id}/shapes", headers=_headers(), json=body,
    )
    _raise_for_status_with_details(resp, action="shape creation", payload=body)
    return resp.json()["id"]


async def _add_connector(
    client: httpx.AsyncClient,
    board_id: str,
    start_id: str,
    end_id: str,
    label: str = "",
    color: str = "#4262FF",
) -> None:
    body: dict[str, Any] = {
        "startItem": {"id": start_id},
        "endItem": {"id": end_id},
        "style": {
            "strokeColor": color,
            "strokeWidth": "2",
            "startStrokeCap": "none",
            "endStrokeCap": "stealth",
        },
    }
    if label:
        body["captions"] = [{"content": label, "position": "50%"}]
    _rate_limit_pause()
    resp = await client.post(
        f"{MIRO_API}/boards/{board_id}/connectors", headers=_headers(), json=body,
    )
    _raise_for_status_with_details(resp, action="connector creation", payload=body)


async def _add_sticky(
    client: httpx.AsyncClient,
    board_id: str,
    *,
    content: str,
    x: float,
    y: float,
    fill_color: str = "yellow",
    width: int = 250,
) -> str:
    valid_colors = {"gray", "light_yellow", "yellow", "orange", "light_green", "green",
                    "dark_green", "cyan", "light_pink", "pink", "violet", "red", "light_blue", "blue", "dark_blue", "black"}
    if fill_color not in valid_colors:
        fill_color = "yellow"
    body = {
        "data": {"content": content[:6000], "shape": "square"},
        "style": {"fillColor": fill_color},
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    _rate_limit_pause()
    resp = await client.post(
        f"{MIRO_API}/boards/{board_id}/sticky_notes", headers=_headers(), json=body,
    )
    _raise_for_status_with_details(resp, action="sticky note creation", payload=body)
    return resp.json()["id"]


async def _draw_pipeline(
    client: httpx.AsyncClient,
    board_id: str,
) -> dict[str, str]:
    """Draw the top-level LangGraph pipeline as a horizontal flow."""
    ids: dict[str, str] = {}
    x = 0
    y = 0
    prev_id = None

    title_id = await _add_shape(
        client, board_id,
        content="<strong>SafetyGuard Agent Pipeline</strong>",
        x=450, y=-120, width=400, height=50,
        fill_color="#1A1A2E", border_color="#1A1A2E", font_size="18",
    )

    for key, label in _PIPELINE_STEPS:
        sid = await _add_shape(
            client, board_id,
            content=f"<strong>{label}</strong>",
            x=x, y=y, width=220, height=80,
            fill_color="#1A1A2E", border_color="#4262FF",
        )
        ids[key] = sid
        if prev_id:
            await _add_connector(client, board_id, prev_id, sid)
        prev_id = sid
        x += 300

    return ids


async def _draw_agents(
    client: httpx.AsyncClient,
    board_id: str,
    report: dict,
) -> dict[str, str]:
    """Draw the 10 dimension agents as a fan below the dispatch_agents node."""
    ids: dict[str, str] = {}
    findings_data = report.get("findings", {})
    dim_scores = report.get("dimension_scores", {})

    start_x = -400
    y = 200

    for i, (dim_key, dim_label) in enumerate(_DIMENSION_LABELS.items()):
        score = dim_scores.get(dim_key, 100)
        count = 0
        if dim_key in findings_data:
            count = findings_data[dim_key].get("finding_count", 0)

        if score >= 70:
            fill = "#1B5E20"
            border = "#4CAF50"
        elif score >= 40:
            fill = "#E65100"
            border = "#FF9800"
        else:
            fill = "#B71C1C"
            border = "#F44336"

        content = f"<strong>{dim_label}</strong><br/>Score: {score:.0f} | Findings: {count}"

        sid = await _add_shape(
            client, board_id,
            content=content,
            x=start_x + i * 200, y=y,
            width=180, height=90,
            fill_color=fill, border_color=border,
            font_size="12",
        )
        ids[f"agent_{dim_key}"] = sid

    return ids


async def _draw_dependency_graph(
    client: httpx.AsyncClient,
    board_id: str,
    dep_graph: dict,
) -> dict[str, str]:
    """Draw the dependency/architecture graph below the agent row."""
    ids: dict[str, str] = {}
    nodes = dep_graph.get("nodes", [])
    edges = dep_graph.get("edges", [])

    title_id = await _add_shape(
        client, board_id,
        content="<strong>Dependency Graph</strong>",
        x=450, y=370, width=300, height=40,
        fill_color="#1A1A2E", border_color="#1A1A2E", font_size="16",
    )

    start_x = -200
    y = 480

    for i, node in enumerate(nodes):
        ntype = node.get("type", "api")
        color = _NODE_TYPE_COLORS.get(ntype, "#4262FF")
        risk = node.get("riskLevel", "medium")
        border = "#F44336" if risk == "high" else "#FF9800" if risk == "medium" else "#4CAF50"

        sid = await _add_shape(
            client, board_id,
            content=f"<strong>{node.get('label', node['id'])}</strong><br/><em>{ntype}</em>",
            x=start_x + i * 200, y=y,
            width=160, height=70,
            fill_color=color, border_color=border,
            font_size="12",
        )
        ids[f"dep_{node['id']}"] = sid

    for edge in edges:
        src_id = ids.get(f"dep_{edge['source']}")
        tgt_id = ids.get(f"dep_{edge['target']}")
        if src_id and tgt_id:
            await _add_connector(
                client, board_id, src_id, tgt_id,
                label=edge.get("relation", ""),
                color="#9CACBC",
            )

    return ids


async def _draw_findings_summary(
    client: httpx.AsyncClient,
    board_id: str,
    report: dict,
) -> None:
    """Add sticky notes for the top critical/high findings."""
    findings_data = report.get("findings", {})

    all_findings: list[tuple[str, dict]] = []
    for dim_key, dim_data in findings_data.items():
        if not isinstance(dim_data, dict):
            continue
        for f in dim_data.get("findings", []):
            if isinstance(f, dict):
                all_findings.append((dim_key, f))

    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    all_findings.sort(key=lambda x: severity_rank.get(x[1].get("severity", "info"), 99))

    title_id = await _add_shape(
        client, board_id,
        content="<strong>Top Findings</strong>",
        x=450, y=620, width=300, height=40,
        fill_color="#1A1A2E", border_color="#1A1A2E", font_size="16",
    )

    sticky_color_map = {
        "critical": "red",
        "high": "orange",
        "medium": "yellow",
        "low": "light_green",
        "info": "gray",
    }

    x = -300
    y = 730
    col = 0
    for dim_key, finding in all_findings[:12]:
        sev = finding.get("severity", "info")
        label = _DIMENSION_LABELS.get(dim_key, dim_key)
        text = (
            f"<strong>[{sev.upper()}] {label}</strong><br/>"
            f"{finding.get('title', 'Untitled')}<br/><br/>"
            f"<em>{finding.get('suggested_fix', '')[:200]}</em>"
        )
        color = sticky_color_map.get(sev, "yellow")

        await _add_sticky(
            client, board_id,
            content=text,
            x=x + (col % 4) * 280,
            y=y + (col // 4) * 280,
            fill_color=color,
            width=260,
        )
        col += 1
