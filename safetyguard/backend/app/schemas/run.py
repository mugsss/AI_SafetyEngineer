from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.custom_agent import BASE_DIMENSIONS


class StoredCustomAgentSpec(BaseModel):
    """Persisted spec for a user-generated agent (matches generate endpoint output)."""

    slug: str = Field(..., min_length=3, max_length=40)
    display_name: str = Field(..., min_length=1, max_length=120)
    base_dimension: str
    system_prompt: str = Field(..., min_length=10)
    agent_python_stub: str | None = None

    @field_validator("base_dimension")
    @classmethod
    def _base_ok(cls, v: str) -> str:
        if v not in BASE_DIMENSIONS:
            raise ValueError(f"base_dimension must be one of: {', '.join(BASE_DIMENSIONS)}")
        return v


class CreateRunInput(BaseModel):
    repo_url: str | None = None
    upload_id: str | None = None
    branch: str = "main"
    enabled_agents: dict[str, bool] = {
        "risk": True,
        "security": True,
        "hallucinations": True,
        "failures": True,
        "cost": True,
        "privacy": True,
        "observability": True,
        "performance": True,
        "resources": True,
        "redteam": False,
    }
    custom_agents: list[StoredCustomAgentSpec] | None = None

    @model_validator(mode="after")
    def _enable_custom_agent_flags(self) -> "CreateRunInput":
        """Turn on ``custom_<slug>`` in enabled_agents for each attached spec."""
        specs = self.custom_agents or []
        if not specs:
            return self
        merged = {**(self.enabled_agents or {})}
        for s in specs:
            merged[f"custom_{s.slug}"] = True
        self.enabled_agents = merged
        return self


class RunResponse(BaseModel):
    id: str
    user_id: str
    repo_url: str | None
    upload_id: str | None
    branch: str
    status: str
    enabled_agents: dict[str, bool]
    custom_agents: list[dict] | None = None
    started_at: str | None
    finished_at: str | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


class RunListResponse(BaseModel):
    runs: list[RunResponse]
    total: int
    page: int
    limit: int
