"""Application settings.

Env files: we load `safetyguard/.env` first, then optional `backend/.env` overrides.
This matches the repo layout where `.env` often lives in `safetyguard/` while
`uvicorn` is started from `safetyguard/backend/` (so a single `.env` in cwd was never found).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

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
    LLM_MODEL: str = Field(
        default="Qwen/Qwen3-32B",
        validation_alias=AliasChoices("LLM_MODEL", "OPENAI_MODEL"),
    )

    MIRO_ACCESS_TOKEN: str = ""

    # Optional: n8n (or any HTTP listener) — webhook URL from "Webhook" node in n8n
    N8N_WEBHOOK_URL: str = ""
    N8N_WEBHOOK_SECRET: str = ""
    # Optional: n8n Public API (Settings → n8n API) — same host as your instance, no /webhook path
    N8N_BASE_URL: str = ""
    N8N_API_KEY: str = ""
    # Used in webhook payloads for deep links (set to your deployed frontend URL)
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 200

    # Git clone target: leave empty to use tempfile.gettempdir()/safetyguard_repos (recommended on macOS
    # when the project lives under Desktop/iCloud or git gets EPERM writing .git/config under backend/repos).
    CLONE_WORK_DIR: str = ""

    REPO_EXPLORER_MAX_TURNS: int = 8
    AGENT_MAX_TOOL_ROUNDS: int = 3

    # Code graph RAG: local Chroma persist dir (per-run subfolders)
    CODE_INDEX_DIR: str = "./code_index"
    EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "OPENAI_EMBEDDING_MODEL"),
    )
    # Max nodes returned in API / full graph cap for storage
    CODE_GRAPH_MAX_NODES: int = 2500
    CODE_GRAPH_MAX_EDGES: int = 8000

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

    def get_embedding_request(self) -> dict:
        """OpenAI-compatible embeddings API (same base URL/key as LLM by default)."""
        return {
            "base_url": self.FEATHERLESS_API_BASE.rstrip("/"),
            "api_key": self.FEATHERLESS_API_KEY,
            "model": self.EMBEDDING_MODEL,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
