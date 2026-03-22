"""Graph-expanded semantic retrieval over indexed code chunks."""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.code_index_service import _embed_batch

logger = logging.getLogger(__name__)


def _load_collection(run_id: str):
    import chromadb
    from chromadb.config import Settings as ChromaSettings

    index_dir = Path(settings.CODE_INDEX_DIR).resolve() / run_id
    if not index_dir.exists():
        return None
    client = chromadb.PersistentClient(
        path=str(index_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    try:
        return client.get_collection("chunks")
    except Exception:
        return None


def _build_adjacency(edges: list[dict[str, Any]]) -> dict[str, set[str]]:
    adj: dict[str, set[str]] = defaultdict(set)
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if not s or not t:
            continue
        adj[s].add(t)
        adj[t].add(s)
    return adj


def _expand_nodes(seed: set[str], adj: dict[str, set[str]], hop_limit: int) -> set[str]:
    seen = set(seed)
    frontier = set(seed)
    for _ in range(max(0, hop_limit)):
        nxt: set[str] = set()
        for n in frontier:
            for m in adj.get(n, ()):
                if m not in seen:
                    seen.add(m)
                    nxt.add(m)
        frontier = nxt
        if not frontier:
            break
    return seen


def retrieve(
    code_graph: dict[str, Any] | None,
    run_id: str,
    query: str,
    *,
    top_k: int = 8,
    hop_limit: int = 2,
) -> dict[str, Any]:
    """Vector search + graph expansion. Requires Chroma index under CODE_INDEX_DIR."""
    if not query.strip():
        return {
            "chunks": [],
            "expanded_node_ids": [],
            "highlight_edge_ids": [],
            "subgraph_nodes": [],
            "subgraph_edges": [],
            "error": "empty query",
        }

    coll = _load_collection(run_id)
    if coll is None:
        return {
            "chunks": [],
            "expanded_node_ids": [],
            "highlight_edge_ids": [],
            "subgraph_nodes": [],
            "subgraph_edges": [],
            "error": "No vector index for this run. Complete analysis with a real API key or re-run indexing.",
        }

    try:
        q_emb = _embed_batch([query])[0]
        res = coll.query(
            query_embeddings=[q_emb],
            n_results=min(top_k, 64),
            include=["documents", "metadatas", "distances"],
        )
    except Exception as e:
        logger.exception("Chroma query failed: %s", e)
        return {
            "chunks": [],
            "expanded_node_ids": [],
            "highlight_edge_ids": [],
            "subgraph_nodes": [],
            "subgraph_edges": [],
            "error": str(e)[:2000],
        }

    metas = (res.get("metadatas") or [[]])[0]
    docs = (res.get("documents") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    chunks_out: list[dict[str, Any]] = []
    seed: set[str] = set()
    for i, meta in enumerate(metas):
        if not meta:
            continue
        f = meta.get("file", "")
        if f:
            seed.add(f)
        chunks_out.append({
            "file": f,
            "start_line": meta.get("start_line"),
            "end_line": meta.get("end_line"),
            "text": docs[i] if i < len(docs) else "",
            "distance": dists[i] if i < len(dists) else None,
        })

    edges = (code_graph or {}).get("edges") or []
    nodes = (code_graph or {}).get("nodes") or []
    adj = _build_adjacency(edges)
    expanded = _expand_nodes(seed, adj, hop_limit)

    edge_ids = []
    sub_edges = []
    for e in edges:
        s, t = e.get("source"), e.get("target")
        eid = e.get("id", "")
        if s in expanded and t in expanded:
            sub_edges.append(e)
            if s in seed or t in seed:
                edge_ids.append(eid)

    sub_nodes = [n for n in nodes if isinstance(n, dict) and n.get("id") in expanded]

    return {
        "chunks": chunks_out,
        "expanded_node_ids": sorted(expanded),
        "highlight_edge_ids": edge_ids,
        "subgraph_nodes": sub_nodes,
        "subgraph_edges": sub_edges,
        "error": None,
    }
