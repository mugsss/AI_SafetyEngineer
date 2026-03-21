from pydantic import BaseModel


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


class RunResponse(BaseModel):
    id: str
    user_id: str
    repo_url: str | None
    upload_id: str | None
    branch: str
    status: str
    enabled_agents: dict[str, bool]
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
