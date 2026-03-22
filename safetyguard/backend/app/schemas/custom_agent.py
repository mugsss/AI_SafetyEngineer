import re

from pydantic import BaseModel, Field, field_validator

_SLUG_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,39}$")


BASE_DIMENSIONS = (
    "risk",
    "security",
    "hallucinations",
    "failures",
    "cost",
    "privacy",
    "observability",
    "performance",
    "resources",
    "redteam",
)


class CustomAgentConfigInput(BaseModel):
    """User-provided intent for generating a custom analysis agent."""

    name: str = Field(..., min_length=2, max_length=120, description="Short name for this agent")
    mission: str = Field(
        ...,
        min_length=10,
        max_length=4000,
        description="What this agent should look for in the codebase",
    )
    base_dimension: str = Field(
        ...,
        description="Built-in dimension whose static analysis + file tools to reuse",
    )
    constraints: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional: policies, frameworks, or things to avoid",
    )
    output_emphasis: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional: what to prioritize in findings",
    )
    export_generated_module: bool = Field(
        default=False,
        description="If true, write app/agents/generated/{slug}/agent.py and system_prompt.txt",
    )


class GeneratedCustomAgentSpec(BaseModel):
    """Executable spec produced by the LLM (and validated server-side)."""

    slug: str = Field(..., min_length=3, max_length=40)
    display_name: str
    base_dimension: str
    system_prompt: str = Field(..., min_length=20)
    agent_python_stub: str = Field(
        ...,
        description="Illustrative Python that would wire this agent; not executed.",
    )


class GenerateCustomAgentResponse(BaseModel):
    spec: GeneratedCustomAgentSpec
    exported_paths: list[str] | None = None


class ExportAgentPackageInput(BaseModel):
    """Export files from an existing spec without calling the LLM."""

    slug: str = Field(..., min_length=3, max_length=40)
    display_name: str = Field(..., min_length=1, max_length=120)
    base_dimension: str
    system_prompt: str = Field(..., min_length=10)

    @field_validator("slug")
    @classmethod
    def _slug_ok(cls, v: str) -> str:
        s = v.strip()
        if not _SLUG_PATTERN.match(s):
            raise ValueError("slug must match [a-z][a-z0-9_]{2,39}")
        return s

    @field_validator("base_dimension")
    @classmethod
    def _base_ok(cls, v: str) -> str:
        if v not in BASE_DIMENSIONS:
            raise ValueError(f"base_dimension must be one of: {', '.join(BASE_DIMENSIONS)}")
        return v


class ExportAgentPackageResponse(BaseModel):
    exported_paths: list[str]
