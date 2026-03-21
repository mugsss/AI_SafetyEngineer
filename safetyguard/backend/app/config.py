from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
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

    class Config:
        env_file = ".env"
        extra = "ignore"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
