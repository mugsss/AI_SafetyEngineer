"""Application settings.

Env files: we load `safetyguard/.env` first, then optional `backend/.env` overrides.
This matches the repo layout where `.env` often lives in `safetyguard/` while
`uvicorn` is started from `safetyguard/backend/` (so a single `.env` in cwd was never found).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# app/config.py -> app/ -> backend/
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
# backend/ -> safetyguard/
_REPO_ROOT = _BACKEND_ROOT.parent


def _env_file_paths() -> tuple[str, ...]:
    """Env files in merge order (later overrides earlier)."""
    paths: list[Path] = [_REPO_ROOT / ".env", _BACKEND_ROOT / ".env"]
    return tuple(str(p) for p in paths if p.is_file())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file_paths() or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "sqlite:///./safetyguard.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret-key-change-in-production-min32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    FEATHERLESS_API_KEY: str = "mock"
    FEATHERLESS_API_BASE: str = "https://api.featherless.ai/v1"
    LLM_MODEL: str = "Qwen/Qwen3-32B"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 200

    REPO_EXPLORER_MAX_TURNS: int = 8
    AGENT_MAX_TOOL_ROUNDS: int = 3

    @property
    def is_mock_mode(self) -> bool:
        return not self.FEATHERLESS_API_KEY or self.FEATHERLESS_API_KEY == "mock"

    def get_llm_kwargs(self) -> dict:
        """Common kwargs for the LLM client (Featherless AI)."""
        return {
            "model": self.LLM_MODEL,
            "temperature": 0,
            "base_url": self.FEATHERLESS_API_BASE,
            "api_key": self.FEATHERLESS_API_KEY,
            "max_retries": 3,
            "request_timeout": 90,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
