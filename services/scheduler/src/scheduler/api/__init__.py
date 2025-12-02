"""FastAPI application for the scheduler service."""

from scheduler.api.app import create_app

__all__ = ["create_app"]
