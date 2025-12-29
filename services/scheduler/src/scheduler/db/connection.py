"""PostgreSQL connection pool for scheduler service.

Uses asyncpg for high-performance async database access.
Pool is configured for long-running solver operations (30s-15min).
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg
import structlog

from scheduler.config import get_settings

logger = structlog.get_logger(__name__)

# Global pool instance
_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Initialize connection pool (call at startup).

    Returns:
        The initialized connection pool.
    """
    global _pool
    if _pool is None:
        settings = get_settings()

        # Convert Pydantic PostgresDsn to string for asyncpg
        dsn = str(settings.database_url)

        logger.info(
            "Initializing database connection pool",
            min_size=2,
            max_size=settings.db_pool_size + settings.db_max_overflow,
        )

        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=settings.db_pool_size + settings.db_max_overflow,
            command_timeout=120,  # Long timeout for bulk operations
            statement_cache_size=100,
        )

        logger.info("Database connection pool initialized")

    return _pool


async def close_pool() -> None:
    """Close connection pool (call at shutdown)."""
    global _pool
    if _pool:
        logger.info("Closing database connection pool")
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get connection from pool with automatic release.

    Usage:
        async with get_connection() as conn:
            rows = await conn.fetch("SELECT * FROM ...")

    Yields:
        An asyncpg connection from the pool.
    """
    pool = await init_pool()
    async with pool.acquire() as conn:
        yield conn


async def check_connection() -> bool:
    """Verify database connectivity for health checks.

    Returns:
        True if connection is healthy, False otherwise.
    """
    try:
        async with get_connection() as conn:
            result = await conn.fetchval("SELECT 1")
            return result == 1
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return False
