"""Application settings.

Env files: we load `safetyguard/.env` first, then optional `backend/.env` overrides.
This matches the repo layout where `.env` often lives in `safetyguard/` while
`uvicorn` is started from `safetyguard/backend/` (so a single `.env` in cwd was never found).

LLM providers (first match wins):
1. ``OPENAI_API_KEY`` — OpenAI or any OpenAI-compatible API (optional ``OPENAI_BASE_URL``).
2. ``FEATHERLESS_API_KEY`` — Featherless AI (open models).

If neither is set (or key is the literal ``mock``), ``is_mock_mode`` is true.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# app/config.py -> app/ -> backend/
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
# backend/ -> safetyguard/
_REPO_ROOT = _BACKEND_ROOT.parent


def _env_file_paths() -> tuple[str, ...]:
    """Env files in merge order (later overrides earlier)."""
    paths: list[Path] = [_REPO_ROOT / ".env", _BACKEND_ROOT / ".env"]
    return tuple(str(p) for p in paths if p.is_file())


def _is_placeholder_key(key: str) -> bool:
    k = (key or "").strip()
    return not k or k.lower() == "mock"


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

    # --- OpenAI (or compatible) — checked first when key is set ---
    OPENAI_API_KEY: str = ""
    # Optional: Azure OpenAI, local LLM, etc. Omit for api.openai.com.
    OPENAI_BASE_URL: str = ""
    # Optional: overrides default model when OpenAI is the active provider (e.g. gpt-4o-mini).
    OPENAI_MODEL: str = ""

    FEATHERLESS_API_KEY: str = "mock"
    FEATHERLESS_API_BASE: str = "https://api.featherless.ai/v1"
    # Default model for Featherless; also used as OpenAI model if it looks like an OpenAI id.
    LLM_MODEL: str = Field(
        default="Qwen/Qwen3-32B",
        validation_alias=AliasChoices("LLM_MODEL"),
    )

    MIRO_ACCESS_TOKEN: str = ""

    # Optional: n8n (or any HTTP listener) — webhook URL from "Webhook" node in n8n
    N8N_WEBHOOK_URL: str = ""
    N8N_WEBHOOK_SECRET: str = ""
    # Optional: n8n Public API (Settings → n8n API in n8n) — same host as your instance, no /webhook path
    N8N_BASE_URL: str = ""
    N8N_API_KEY: str = ""
    # Used in webhook payloads for deep links (set to your deployed frontend URL)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 200

    REPO_EXPLORER_MAX_TURNS: int = 8
    AGENT_MAX_TOOL_ROUNDS: int = 3

    def llm_provider(self) -> Literal["openai", "featherless"] | None:
        """Which provider is active."""
        if not _is_placeholder_key(self.OPENAI_API_KEY):
            return "openai"
        if not _is_placeholder_key(self.FEATHERLESS_API_KEY):
            return "featherless"
        return None

    @property
    def is_mock_mode(self) -> bool:
        return self.llm_provider() is None

    def resolved_llm_model(self) -> str:
        """Model id for the active provider."""
        p = self.llm_provider()
        if p == "openai":
            if self.OPENAI_MODEL.strip():
                return self.OPENAI_MODEL.strip()
            lm = self.LLM_MODEL.strip()
            # Featherless-style ids (org/model) are not valid OpenAI model names.
            if lm and "/" not in lm and not lm.startswith("Qwen"):
                return lm
            return "gpt-4o-mini"
        return self.LLM_MODEL.strip() or "Qwen/Qwen3-32B"

    def get_llm_kwargs(self) -> dict:
        """Kwargs for ``langchain_openai.ChatOpenAI``."""
        provider = self.llm_provider()
        if provider is None:
            raise RuntimeError("get_llm_kwargs called with no LLM API key configured")

        common = {
            "temperature": 0,
            "max_retries": 3,
            "request_timeout": 90,
        }
        model = self.resolved_llm_model()

        if provider == "openai":
            out: dict = {
                "model": model,
                "api_key": self.OPENAI_API_KEY.strip(),
                **common,
            }
            if self.OPENAI_BASE_URL.strip():
                out["base_url"] = self.OPENAI_BASE_URL.strip()
            return out

        return {
            "model": model,
            "base_url": self.FEATHERLESS_API_BASE,
            "api_key": self.FEATHERLESS_API_KEY.strip(),
            **common,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
