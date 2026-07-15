from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict

CorsOrigins = Annotated[list[str], BeforeValidator(lambda value: _split_cors(value))]


def _split_cors(value: list[str] | str) -> list[str]:
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


class Settings(BaseSettings):
    """Configuration values loaded from environment variables."""

    # The repo root .env contains frontend/nginx variables too; ignore unknown keys.
    model_config = SettingsConfigDict(env_file=".env", env_nested_delimiter="__", extra="ignore")

    app_name: str = "Value at Risk API"
    api_v1_str: str = "/api/v1"
    cors_origins: CorsOrigins = ["http://localhost:3000", "http://localhost:3100"]
    proxy_url: str | None = None
    no_proxy: str | None = None

    chdb_url: str = "100.66.149.33"
    chdb_port: str = "9000"
    chdb_user: str = "chuser"
    chdb_password: str = "password"
    chdb_database: str = "vardb"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""

    return Settings()


settings = get_settings()
