"""Configuration management for the scheduler service."""

from functools import lru_cache

from pydantic import Field, PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SCHEDULER_",
        case_sensitive=False,
    )

    # Service
    service_name: str = "sis-scheduler"
    debug: bool = False
    log_level: str = "INFO"

    # Database
    database_url: PostgresDsn = Field(
        default="postgresql://postgres:postgres@localhost:5432/sis",
        description="PostgreSQL connection URL",
    )
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=10, ge=0, le=50)

    # Redis (for job queue)
    redis_url: RedisDsn = Field(
        default="redis://localhost:6379/1",
        description="Redis connection URL for job queue",
    )

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    api_workers: int = 1

    # Solver defaults
    solver_time_limit_seconds: int = Field(
        default=300,
        ge=10,
        le=3600,
        description="Maximum solve time in seconds",
    )
    solver_num_workers: int = Field(
        default=4,
        ge=1,
        le=16,
        description="Number of parallel workers for solver",
    )
    solver_log_search_progress: bool = False

    # Callback URL for notifying main app
    callback_base_url: str = Field(
        default="http://localhost:3000/api/trpc",
        description="Base URL for tRPC callbacks",
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
