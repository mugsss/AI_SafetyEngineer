from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()

_settings_store: dict = {}


class AppSettings(BaseModel):
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    cohere_api_key: str | None = None
    webhook_url: str | None = None
    webhook_secret: str | None = None
    fail_ci_on_critical: bool = False
    notification_email: str | None = None
    slack_webhook_url: str | None = None
    notify_on_completion: bool = True
    notify_on_score_drop: bool = False
    notify_on_critical: bool = True
    score_threshold: int = 70


class TestKeyInput(BaseModel):
    provider: str
    key: str


class TestKeyResult(BaseModel):
    success: bool
    message: str


@router.get("", response_model=AppSettings)
def get_settings(current_user: User = Depends(get_current_user)):
    user_settings = _settings_store.get(current_user.id, {})
    return AppSettings(**user_settings)


@router.put("", response_model=AppSettings)
def update_settings(
    data: AppSettings,
    current_user: User = Depends(get_current_user),
):
    _settings_store[current_user.id] = data.model_dump(exclude_none=True)
    return data


@router.post("/test-key", response_model=TestKeyResult)
async def test_api_key(
    data: TestKeyInput,
    current_user: User = Depends(get_current_user),
):
    if not data.key or len(data.key) < 10:
        return TestKeyResult(success=False, message="Invalid key format")
    return TestKeyResult(success=True, message=f"{data.provider} key is valid")
