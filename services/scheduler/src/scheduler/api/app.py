"""FastAPI application for the scheduler service."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scheduler.api.routes import router
from scheduler.config import get_settings
from scheduler.db import close_pool, init_pool

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    settings = get_settings()
    logger.info(
        "Starting scheduler service",
        service_name=settings.service_name,
        debug=settings.debug,
    )

    # Initialize database connection pool
    await init_pool()

    # TODO: Initialize Redis connection for job queue

    yield

    # Cleanup
    logger.info("Shutting down scheduler service")
    await close_pool()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="SIS Course Scheduler",
        description="Course scheduling optimization service using OR-Tools CP-SAT solver",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routes
    app.include_router(router)

    return app


# Create app instance for uvicorn
app = create_app()
