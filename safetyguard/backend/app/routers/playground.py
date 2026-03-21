from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.models.user import User
from app.dependencies import get_current_user
from app.services.playground_service import run_playground_query

router = APIRouter()


class PlaygroundInput(BaseModel):
    prompt: str
    app_base_url: str | None = None
    model_profile: str | None = None


class PlaygroundResult(BaseModel):
    response_text: str
    hallucination_score: float
    safety_flags: list[str]
    explanation: str


@router.post("/query", response_model=PlaygroundResult)
async def playground_query(
    data: PlaygroundInput,
    current_user: User = Depends(get_current_user),
):
    result = await run_playground_query(
        prompt=data.prompt,
        app_base_url=data.app_base_url,
        model_profile=data.model_profile,
    )
    return result
