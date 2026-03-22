"""LLM-backed generation of custom agent specs (prompt + stub code)."""

from __future__ import annotations

import json
import logging
import re

from langchain_openai import ChatOpenAI

from app.config import settings
from app.schemas.custom_agent import (
    BASE_DIMENSIONS,
    CustomAgentConfigInput,
    GeneratedCustomAgentSpec,
)

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{2,39}$")


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower().strip())
    s = s.strip("_") or "custom_agent"
    if not s[0].isalpha():
        s = "c_" + s
    return s[:40]


def _parse_llm_json(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def generate_custom_agent_spec(config: CustomAgentConfigInput) -> GeneratedCustomAgentSpec:
    """Use the configured LLM to turn user intent into a runnable agent specification."""
    if config.base_dimension not in BASE_DIMENSIONS:
        raise ValueError(f"base_dimension must be one of: {', '.join(BASE_DIMENSIONS)}")

    slug: str | None = None
    display_name: str | None = None
    bd: str = config.base_dimension
    system_prompt: str | None = None

    if not settings.is_mock_mode:
        try:
            llm = ChatOpenAI(**settings.get_llm_kwargs())
            system = (
                "You are an expert at designing SafetyGuard custom dimension agents.\n"
                "At analysis time the backend runs `run_custom_dimension_agent` which combines "
                "(1) static analysis for the chosen base_dimension and (2) an LLM pass with that "
                "dimension's file tools, using your system_prompt (with {static_summary} filled "
                "from static findings).\n\n"
                "Given the user's configuration, output a SINGLE JSON object with keys:\n"
                "- slug: lowercase identifier [a-z][a-z0-9_]{2,39}\n"
                "- display_name: human-readable short title\n"
                "- base_dimension: must equal the user's requested base dimension\n"
                "- system_prompt: a detailed system prompt for the LLM analyst. It MUST contain "
                "the literal substring {static_summary}. The prompt must instruct returning ONLY "
                "a JSON array of findings; each finding: id, dimension, title, severity, "
                "description, evidence {file,line,snippet}, suggested_fix. No markdown fences.\n"
                "- agent_python_stub: a short illustrative async Python function.\n\n"
                "Return ONLY valid JSON, no markdown."
            )
            user = json.dumps(
                {
                    "name": config.name,
                    "mission": config.mission,
                    "base_dimension": config.base_dimension,
                    "constraints": config.constraints,
                    "output_emphasis": config.output_emphasis,
                },
                ensure_ascii=False,
            )
            response = llm.invoke(
                [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
            )
            raw = response.content
            if isinstance(raw, list):
                raw = "".join(str(x) for x in raw)
            data = _parse_llm_json(raw or "{}")

            slug = str(data.get("slug", "")).strip() or None
            display_name = str(data.get("display_name", "")).strip() or None
            _bd = str(data.get("base_dimension", "")).strip()
            if _bd in BASE_DIMENSIONS:
                bd = _bd
            system_prompt = str(data.get("system_prompt", "")).strip() or None
        except Exception as exc:
            logger.warning("LLM spec generation failed, falling back to deterministic: %s", exc)

    if not slug or not _SLUG_RE.match(slug):
        slug = _slugify(config.name)
    if not display_name:
        display_name = config.name[:120]

    if not system_prompt:
        constraints_block = (
            f"\n\nConstraints / policies to respect:\n{config.constraints}"
            if config.constraints
            else ""
        )
        emphasis_block = (
            f"\n\nOutput emphasis — prioritize findings related to:\n{config.output_emphasis}"
            if config.output_emphasis
            else ""
        )
        system_prompt = (
            f"You are a SafetyGuard custom analysis agent: {display_name}.\n"
            f"Mission: {config.mission}\n"
            f"Base dimension: {bd}\n"
            f"{constraints_block}{emphasis_block}\n\n"
            "A static analysis pass already identified these issues (do NOT duplicate them):\n"
            "{static_summary}\n\n"
            "Analyze the repository and return ONLY a JSON array of NEW findings.\n"
            "Each finding must have: id, dimension, title, severity "
            "(critical/high/medium/low/info), description, evidence "
            "(object with file, line, snippet), suggested_fix.\n"
            "No markdown fences — raw JSON only."
        )

    if "{static_summary}" not in system_prompt:
        system_prompt += (
            "\n\nA static analysis pass already identified these issues (do NOT duplicate them):\n"
            "{static_summary}\n"
        )

    stub = (
        f"async def {slug}_agent(state):\n"
        f"    return await run_custom_dimension_agent(\n"
        f"        slug={slug!r}, display_name={display_name!r}, base_dimension={bd!r},\n"
        f"        system_prompt=GENERATED_PROMPT, state=state, progress=55,\n"
        "    )\n"
    )

    return GeneratedCustomAgentSpec(
        slug=slug,
        display_name=display_name,
        base_dimension=bd,
        system_prompt=system_prompt,
        agent_python_stub=stub,
    )
