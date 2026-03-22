"""Build repository import graph, chunk source files, and index embeddings (Chroma)."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from pathlib import Path
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_SOURCE_EXT = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}

# Match TS/JS import/export (single-line, common cases)
_RE_JS_IMPORT = re.compile(
    r"""^(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))*\s+from\s+)?['"]([^'"]+)['"]|"""
    r"""import\s*\(\s*['"]([^'"]+)['"]\s*\)|"""
    r"""export\s+.*?\s+from\s+['"]([^'"]+)['"])""",
    re.MULTILINE,
)
_RE_PY_IMPORT = re.compile(r"^\s*import\s+([\w.,\s]+)(?:\s+#|$)", re.MULTILINE)


def _should_skip_dir(name: str) -> bool:
    return name in {
        ".git", "node_modules", "__pycache__", "dist", "build", ".next",
        ".venv", "venv", "env", ".egg-info", ".tox", "htmlcov", ".mypy_cache",
        ".pytest_cache", "coverage", ".nuxt", "target",
    }


def _iter_source_files(repo_root: str) -> list[str]:
    out: list[str] = []
    root = Path(repo_root).resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not _should_skip_dir(d)]
        for fn in filenames:
            ext = Path(fn).suffix.lower()
            if ext not in _SOURCE_EXT:
                continue
            full = Path(dirpath) / fn
            rel = full.relative_to(root).as_posix()
            out.append(rel)
    return sorted(out)


def _try_resolve_py_module(
    module: str,
    repo_root: Path,
    file_set: set[str],
) -> str | None:
    """Map dotted module to repo-relative path if it exists."""
    parts = module.split(".")
    for i in range(len(parts), 0, -1):
        prefix = "/".join(parts[:i])
        for candidate in (f"{prefix}.py", f"{prefix}/__init__.py"):
            if candidate in file_set:
                return candidate
    return None


def _resolve_relative_py_import(
    dots: str,
    rest: str,
    current_dir: str,
    file_set: set[str],
) -> str | None:
    """Resolve `from .xxx` / `from ..pkg` style imports to a file path."""
    up_levels = len(dots) - 1
    parts = current_dir.split("/") if current_dir else []
    if up_levels > len(parts):
        return None
    base = parts[:-up_levels] if up_levels else parts
    if rest:
        tail = rest.split(".")
        cand_parts = base + tail
        cand = "/".join(cand_parts)
        for variant in (f"{cand}.py", f"{cand}/__init__.py"):
            if variant in file_set:
                return variant
    return None


def _extract_python_imports(
    content: str,
    rel_path: str,
    file_set: set[str],
    repo_root: Path,
) -> list[tuple[str, str | None]]:
    """Return list of (relation, resolved_target_or_none)."""
    edges: list[tuple[str, str | None]] = []
    current_dir = str(Path(rel_path).parent.as_posix())
    if current_dir == ".":
        current_dir = ""

    _RE_FROM_LINE = re.compile(
        r"^\s*from\s+(\.+)([\w.]*)\s+import\s+",
    )
    for line in content.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        m = _RE_FROM_LINE.match(line)
        if m:
            dots, rest = m.group(1), (m.group(2) or "").strip()
            if not rest:
                continue
            resolved = _resolve_relative_py_import(dots, rest, current_dir, file_set)
            edges.append(("imports", resolved))
            continue
        m_abs = re.match(r"^\s*from\s+([\w.]+)\s+import\s+", line)
        if m_abs:
            mod = m_abs.group(1)
            if mod.startswith("."):
                continue
            resolved = _try_resolve_py_module(mod, repo_root, file_set)
            edges.append(("imports", resolved))

    for m in _RE_PY_IMPORT.finditer(content):
        block = m.group(1)
        for part in block.split(","):
            name = part.strip().split(" as ")[0].strip()
            if not name:
                continue
            top = name.split(".")[0]
            resolved = _try_resolve_py_module(top, repo_root, file_set)
            edges.append(("imports", resolved))

    return edges


def _normalize_js_path(
    base_dir: str,
    spec: str,
    repo_root: Path,
    file_set: set[str],
) -> str | None:
    spec = spec.strip()
    if not spec or spec.startswith(("http:", "https:", "data:")):
        return None
    if not spec.startswith("."):
        return None
    base = Path(base_dir) if base_dir else Path(".")
    target = (base / spec).resolve()
    try:
        rel = target.relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return None
    if rel in file_set:
        return rel
    for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
        cand = rel + ext
        if cand in file_set:
            return cand
    for idx in ("/index.ts", "/index.tsx", "/index.js", "/index.jsx"):
        cand = rel + idx
        if cand in file_set:
            return cand
    return None


def _extract_js_imports(
    content: str,
    rel_path: str,
    repo_root: Path,
    file_set: set[str],
) -> list[tuple[str, str | None]]:
    edges: list[tuple[str, str | None]] = []
    base_dir = Path(rel_path).parent.as_posix()
    if base_dir == ".":
        base_dir = ""
    for m in _RE_JS_IMPORT.finditer(content):
        spec = next((g for g in m.groups() if g), None)
        if not spec:
            continue
        resolved = _normalize_js_path(base_dir, spec, repo_root, file_set)
        edges.append(("imports", resolved))
    return edges


def _chunk_text(rel_path: str, text: str, max_chars: int = 1200, overlap: int = 200) -> list[dict[str, Any]]:
    lines = text.splitlines()
    if not lines:
        return []
    chunks: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        start_idx = i
        start_line = i + 1
        buf: list[str] = []
        char_count = 0
        while i < len(lines) and char_count < max_chars:
            buf.append(lines[i])
            char_count += len(lines[i]) + 1
            i += 1
        body = "\n".join(buf).strip()
        if body:
            chunks.append({
                "file": rel_path,
                "start_line": start_line,
                "end_line": i,
                "text": f"{rel_path}\n{body}",
            })
        if i >= len(lines):
            break
        # rewind for overlap (by lines)
        back = max(0, overlap // 40)
        i = max(start_idx + 1, i - back)
    return chunks[:200]


def _embed_batch(texts: list[str]) -> list[list[float]]:
    cfg = settings.get_embedding_request()
    if settings.is_mock_mode:
        # Deterministic fake vectors for tests
        out: list[list[float]] = []
        for t in texts:
            h = hashlib.sha256(t.encode()).digest()
            vec = [((h[i % len(h)] - 128) / 128.0) for i in range(64)]
            out.append(vec)
        return out

    url = f"{cfg['base_url']}/embeddings"
    headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
    payload = {"model": cfg["model"], "input": texts}
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
        return [item["embedding"] for item in data["data"]]


def index_codebase(run_id: str, repo_path: str) -> dict[str, Any]:
    """Build code graph, chunk files, persist Chroma collection when not in mock mode."""
    repo_root = Path(repo_path).resolve()
    index_dir = Path(settings.CODE_INDEX_DIR).resolve() / run_id
    files = _iter_source_files(str(repo_root))
    file_set = set(files)

    ext_placeholder = "external:unresolved"
    nodes: dict[str, dict[str, Any]] = {
        ext_placeholder: {
            "id": ext_placeholder,
            "label": "external / unresolved",
            "type": "external",
            "language": "external",
        },
    }
    edges: list[dict[str, Any]] = []
    edge_id = 0

    for rel in files:
        nodes[rel] = {
            "id": rel,
            "label": Path(rel).name,
            "type": "file",
            "language": Path(rel).suffix.lower().lstrip(".") or "unknown",
        }

    for rel in files:
        full = repo_root / rel
        try:
            content = full.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        ext = Path(rel).suffix.lower()
        if ext == ".py":
            pairs = _extract_python_imports(content, rel, file_set, repo_root)
        else:
            pairs = _extract_js_imports(content, rel, repo_root, file_set)

        for rel_type, target in pairs:
            if not target:
                tgt = ext_placeholder
            else:
                tgt = target
                if tgt not in nodes:
                    nodes[tgt] = {
                        "id": tgt,
                        "label": Path(tgt).name,
                        "type": "file",
                        "language": Path(tgt).suffix.lower().lstrip(".") or "unknown",
                    }
            edges.append({
                "id": f"e_{edge_id}",
                "source": rel,
                "target": tgt,
                "relation": rel_type,
            })
            edge_id += 1

    # Cap edge count (keep all nodes so references stay valid)
    stats = {"file_count": len(files), "edge_count": len(edges), "truncated": False}
    node_list = list(nodes.values())
    if len(edges) > settings.CODE_GRAPH_MAX_EDGES:
        edges = edges[: settings.CODE_GRAPH_MAX_EDGES]
        stats["truncated"] = True

    graph = {
        "nodes": node_list,
        "edges": edges,
        "stats": stats,
    }

    all_chunks: list[dict[str, Any]] = []
    for rel in files:
        full = repo_root / rel
        try:
            text = full.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        all_chunks.extend(_chunk_text(rel, text))

    vector_ready = False
    if all_chunks:
        try:
            os.makedirs(index_dir, parent=True)
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            client = chromadb.PersistentClient(
                path=str(index_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            coll = client.get_or_create_collection(
                name="chunks",
                metadata={"run_id": run_id},
            )
            try:
                existing = coll.get()
                if existing and existing.get("ids"):
                    coll.delete(ids=existing["ids"])
            except Exception:
                pass

            batch_size = 32
            for batch_start in range(0, len(all_chunks), batch_size):
                batch = all_chunks[batch_start : batch_start + batch_size]
                texts = [c["text"] for c in batch]
                embs = _embed_batch(texts)
                ids = [f"{run_id}_{batch_start + j}" for j in range(len(batch))]
                metadatas = [
                    {
                        "file": c["file"],
                        "start_line": str(c["start_line"]),
                        "end_line": str(c["end_line"]),
                    }
                    for c in batch
                ]
                coll.add(ids=ids, embeddings=embs, documents=texts, metadatas=metadatas)
            vector_ready = True
        except Exception as e:
            logger.exception("Vector index failed for run %s: %s", run_id, e)
            graph["stats"]["vector_index_ready"] = False
            return {
                "graph": graph,
                "status": "partial",
                "error": str(e)[:2000],
                "vector_index_ready": False,
            }

    status = "completed"
    if not vector_ready and all_chunks:
        status = "partial"

    graph["stats"]["vector_index_ready"] = vector_ready

    return {
        "graph": graph,
        "status": status,
        "error": None,
        "vector_index_ready": vector_ready,
    }


def cleanup_code_index(run_id: str) -> None:
    """Remove persisted Chroma data for a run."""
    import shutil

    path = Path(settings.CODE_INDEX_DIR).resolve() / run_id
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
