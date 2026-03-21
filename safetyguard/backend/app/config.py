from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./safetyguard.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret-key-change-in-production-min32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    OPENAI_API_KEY: str = "mock"
    OPENAI_MODEL: str = "gpt-4o"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 200

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def is_mock_mode(self) -> bool:
        return not self.OPENAI_API_KEY or self.OPENAI_API_KEY == "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
