from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "sqlite:///./safetyguard.db"
    REDIS_URL: str = "redis://localhost:6379/0"
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
        }


settings = Settings()
