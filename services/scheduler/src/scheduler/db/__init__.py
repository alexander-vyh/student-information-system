"""Database layer for scheduler service.

Provides bidirectional data access following UniTime's loader/saver pattern:
- load_solver_input(): Hydrate domain models from PostgreSQL
- save_solver_output(): Persist solver results atomically
"""

from scheduler.db.connection import close_pool, get_connection, init_pool
from scheduler.db.repository import load_solver_input, save_solver_output

__all__ = [
    "init_pool",
    "close_pool",
    "get_connection",
    "load_solver_input",
    "save_solver_output",
]
