import os
import re
from pathlib import Path

from langchain_core.tools import tool

EXCLUDED_DIRS = {
    ".git", "node_modules", "__pycache__", "dist", "build",
    ".next", ".venv", "venv", "env", ".egg-info", ".tox",
    "htmlcov", ".mypy_cache", ".pytest_cache",
}
EXCLUDED_EXTENSIONS = {".lock", ".pyc", ".pyo", ".so", ".dylib", ".whl", ".egg"}

_repo_root: str = ""


def set_repo_root(path: str) -> None:
    global _repo_root
    _repo_root = path


def _safe_path(path: str) -> str:
    resolved = os.path.normpath(os.path.join(_repo_root, path))
    if not resolved.startswith(os.path.normpath(_repo_root)):
        raise ValueError("Path traversal detected")
    return resolved


def _should_skip(name: str, is_dir: bool) -> bool:
    if is_dir:
        return name in EXCLUDED_DIRS
    _, ext = os.path.splitext(name)
    return ext in EXCLUDED_EXTENSIONS


@tool
def list_files(path: str = "") -> str:
    """List all files in the repository or a subdirectory. Returns the file tree filtered to exclude build artifacts, dependencies, and binary files."""
    target = _safe_path(path) if path else _repo_root
    if not os.path.isdir(target):
        return f"Error: '{path}' is not a directory"

    files = []
    for root, dirs, filenames in os.walk(target):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        rel_root = os.path.relpath(root, _repo_root)
        for f in sorted(filenames):
            if not _should_skip(f, False):
                rel_path = os.path.join(rel_root, f) if rel_root != "." else f
                files.append(rel_path)

    if not files:
        return "No files found."
    return "\n".join(files[:500])


@tool
def read_file(path: str, max_lines: int = 200) -> str:
    """Read the content of a single file from the repository. Returns at most max_lines lines to avoid context overflow."""
    full_path = _safe_path(path)
    if not os.path.isfile(full_path):
        return f"Error: '{path}' not found"

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        return f"Error reading '{path}': {str(e)}"

    total = len(lines)
    content = "".join(lines[:max_lines])
    if total > max_lines:
        content += f"\n... ({total - max_lines} more lines truncated)"
    return f"File: {path} ({total} lines)\n{content}"


@tool
def search_code(query: str, file_glob: str = "") -> str:
    """Search the repository for a keyword or regex pattern. Returns matching file paths, line numbers, and snippets. Use file_glob to restrict to specific file types (e.g. '*.py')."""
    results = []
    try:
        pattern = re.compile(query, re.IGNORECASE)
    except re.error:
        pattern = re.compile(re.escape(query), re.IGNORECASE)

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if _should_skip(fname, False):
                continue
            if file_glob:
                if not Path(fname).match(file_glob):
                    continue
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, _repo_root)
            try:
                with open(full, "r", encoding="utf-8", errors="replace") as f:
                    for i, line in enumerate(f, 1):
                        if pattern.search(line):
                            snippet = line.strip()[:120]
                            results.append(f"{rel}:{i}: {snippet}")
                            if len(results) >= 50:
                                return "\n".join(results) + "\n... (50 result limit reached)"
            except Exception:
                continue

    if not results:
        return f"No matches found for '{query}'"
    return "\n".join(results)


@tool
def read_directory(path: str = "") -> str:
    """List the contents of a specific directory with file sizes and types."""
    target = _safe_path(path) if path else _repo_root
    if not os.path.isdir(target):
        return f"Error: '{path}' is not a directory"

    entries = []
    for name in sorted(os.listdir(target)):
        if _should_skip(name, os.path.isdir(os.path.join(target, name))):
            continue
        full = os.path.join(target, name)
        if os.path.isdir(full):
            entries.append(f"  [DIR]  {name}/")
        else:
            size = os.path.getsize(full)
            if size < 1024:
                size_str = f"{size}B"
            elif size < 1024 * 1024:
                size_str = f"{size / 1024:.1f}KB"
            else:
                size_str = f"{size / 1024 / 1024:.1f}MB"
            entries.append(f"  {size_str:>8}  {name}")

    return f"Directory: {path or '.'}\n" + "\n".join(entries) if entries else "Empty directory"


@tool
def find_openapi_spec() -> str:
    """Search the repository for OpenAPI/Swagger specification files. Returns the content of the first spec file found."""
    spec_patterns = [
        "openapi.json", "openapi.yaml", "openapi.yml",
        "swagger.json", "swagger.yaml", "swagger.yml",
        "api-spec.json", "api-spec.yaml", "api-spec.yml",
    ]

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if fname.lower() in spec_patterns:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, _repo_root)
                try:
                    with open(full, "r", encoding="utf-8") as f:
                        content = f.read(10000)
                    return f"Found: {rel}\n{content}"
                except Exception:
                    continue

    return "No OpenAPI/Swagger specification found"


@tool
def get_repo_metadata() -> str:
    """Get repository metadata: detected languages, frameworks, dependency files, and size statistics."""
    ext_counts: dict[str, int] = {}
    total_files = 0
    total_size = 0
    dep_files = []
    frameworks = []

    dep_file_names = {
        "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
        "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "go.mod", "Cargo.toml", "Gemfile", "build.gradle", "pom.xml",
        "composer.json",
    }
    framework_indicators = {
        "fastapi": ["from fastapi", "import fastapi"],
        "django": ["from django", "DJANGO_SETTINGS"],
        "flask": ["from flask", "Flask(__name__)"],
        "nextjs": ['"next":', "next.config"],
        "react": ['"react":', "from 'react'"],
        "langchain": ["from langchain", "import langchain"],
        "express": ["require('express')", "from 'express'"],
    }

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if _should_skip(fname, False):
                continue
            total_files += 1
            full = os.path.join(root, fname)
            total_size += os.path.getsize(full)
            ext = os.path.splitext(fname)[1] or "(no ext)"
            ext_counts[ext] = ext_counts.get(ext, 0) + 1
            if fname in dep_file_names:
                dep_files.append(os.path.relpath(full, _repo_root))

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if fname.endswith((".py", ".js", ".ts", ".tsx", ".json")):
                full = os.path.join(root, fname)
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(5000)
                    for fw, indicators in framework_indicators.items():
                        if any(ind in content for ind in indicators):
                            if fw not in frameworks:
                                frameworks.append(fw)
                except Exception:
                    continue
            if len(frameworks) >= 5:
                break

    top_langs = sorted(ext_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    lang_str = ", ".join(f"{ext}({count})" for ext, count in top_langs)

    size_mb = total_size / 1024 / 1024
    result = [
        f"Total files: {total_files}",
        f"Total size: {size_mb:.1f}MB",
        f"Languages: {lang_str}",
        f"Dependency files: {', '.join(dep_files) if dep_files else 'none'}",
        f"Frameworks detected: {', '.join(frameworks) if frameworks else 'none'}",
    ]
    return "\n".join(result)


@tool
def read_env_files() -> str:
    """Find and read .env files in the repository. Actual secret values are redacted, only key names are shown."""
    env_patterns = [".env", ".env.example", ".env.local", ".env.production", ".env.development", ".env.test"]
    found = []

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if fname in env_patterns:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, _repo_root)
                try:
                    with open(full, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    redacted = []
                    for line in lines:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            redacted.append(line)
                            continue
                        if "=" in line:
                            key = line.split("=", 1)[0].strip()
                            is_example = fname.endswith(".example")
                            if is_example:
                                redacted.append(line)
                            else:
                                redacted.append(f"{key}=[REDACTED]")
                        else:
                            redacted.append(line)
                    found.append(f"--- {rel} ---\n" + "\n".join(redacted))
                except Exception:
                    continue

    return "\n\n".join(found) if found else "No .env files found"


@tool
def read_config_files() -> str:
    """Auto-discover and read configuration files (YAML, JSON, TOML, INI, docker-compose, etc.)."""
    config_patterns = {"config", "settings", "conf"}
    config_extensions = {".yaml", ".yml", ".toml", ".ini", ".cfg", ".json"}
    config_names = {"docker-compose.yml", "docker-compose.yaml", "Dockerfile", "Makefile", ".eslintrc.json", "tsconfig.json"}

    found = []
    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if _should_skip(fname, False):
                continue
            name_lower = fname.lower()
            ext = os.path.splitext(fname)[1]
            is_config = (
                fname in config_names
                or any(p in name_lower for p in config_patterns)
                or ext in config_extensions
            )
            if not is_config:
                continue
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, _repo_root)
            try:
                with open(full, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(3000)
                found.append(f"--- {rel} ---\n{content}")
            except Exception:
                continue
            if len(found) >= 15:
                break

    return "\n\n".join(found) if found else "No config files found"


@tool
def read_prompt_templates() -> str:
    """Search for prompt templates and LLM prompt definitions in the repository."""
    prompt_indicators = ["system", "user", "assistant", "prompt", "template", "<<SYS>>", "Human:", "AI:"]
    prompt_extensions = {".prompt", ".jinja", ".jinja2", ".j2"}
    found = []

    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if _should_skip(fname, False):
                continue
            ext = os.path.splitext(fname)[1]
            name_lower = fname.lower()

            if ext in prompt_extensions or "prompt" in name_lower or "template" in name_lower:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, _repo_root)
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(3000)
                    found.append(f"--- {rel} ---\n{content}")
                except Exception:
                    continue
            elif ext in (".py", ".ts", ".js"):
                full = os.path.join(root, fname)
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read(5000)
                    if any(ind in content for ind in prompt_indicators):
                        has_prompt_patterns = (
                            "system_prompt" in content.lower()
                            or "SYSTEM_PROMPT" in content
                            or "ChatPromptTemplate" in content
                            or "PromptTemplate" in content
                            or "system_message" in content.lower()
                        )
                        if has_prompt_patterns:
                            rel = os.path.relpath(full, _repo_root)
                            found.append(f"--- {rel} ---\n{content[:3000]}")
                except Exception:
                    continue
            if len(found) >= 10:
                break

    return "\n\n".join(found) if found else "No prompt templates found"


@tool
def get_dependency_info() -> str:
    """Parse dependency/package files and return a list of dependencies with versions."""
    dep_files_map = {
        "requirements.txt": _parse_requirements_txt,
        "pyproject.toml": _parse_pyproject_toml,
        "package.json": _parse_package_json,
    }

    results = []
    for root, dirs, filenames in os.walk(_repo_root):
        dirs[:] = [d for d in dirs if not _should_skip(d, True)]
        for fname in filenames:
            if fname in dep_files_map:
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, _repo_root)
                try:
                    with open(full, "r", encoding="utf-8") as f:
                        content = f.read()
                    deps = dep_files_map[fname](content)
                    results.append(f"--- {rel} ---\n{deps}")
                except Exception as e:
                    results.append(f"--- {rel} ---\nError: {e}")

    return "\n\n".join(results) if results else "No dependency files found"


def _parse_requirements_txt(content: str) -> str:
    lines = []
    for line in content.strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("-"):
            lines.append(line)
    return "\n".join(lines) if lines else "No dependencies"


def _parse_pyproject_toml(content: str) -> str:
    deps = []
    in_deps = False
    for line in content.split("\n"):
        if "dependencies" in line and "=" in line:
            in_deps = True
            continue
        if in_deps:
            if line.strip().startswith("]"):
                in_deps = False
                continue
            dep = line.strip().strip('",')
            if dep:
                deps.append(dep)
    return "\n".join(deps) if deps else "No dependencies parsed"


def _parse_package_json(content: str) -> str:
    import json
    try:
        pkg = json.loads(content)
        deps = []
        for section in ["dependencies", "devDependencies"]:
            if section in pkg:
                for name, version in pkg[section].items():
                    deps.append(f"{name}: {version}")
        return "\n".join(deps) if deps else "No dependencies"
    except Exception:
        return "Error parsing package.json"


ALL_TOOLS = [
    list_files, read_file, search_code, read_directory,
    find_openapi_spec, get_repo_metadata, read_env_files,
    read_config_files, read_prompt_templates, get_dependency_info,
]

AGENT_TOOL_MAP: dict[str, list] = {
    "security": [search_code, read_file, read_env_files, find_openapi_spec],
    "risk": [get_repo_metadata, read_config_files, read_file],
    "hallucinations": [read_prompt_templates, find_openapi_spec, search_code],
    "failures": [read_config_files, search_code, read_file],
    "cost": [read_prompt_templates, search_code, read_file],
    "privacy": [search_code, read_file],
    "observability": [read_config_files, search_code, read_file],
    "performance": [search_code, read_file],
    "resources": [search_code, read_config_files],
    "redteam": [read_prompt_templates, search_code, read_file],
}
