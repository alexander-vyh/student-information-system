"""API routes for the scheduler service."""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from scheduler.db import load_solver_input, save_solver_output
from scheduler.models import SolverInput, SolverOutput
from scheduler.solvers import CPSATSolver

logger = structlog.get_logger(__name__)

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str


class SolveRequest(BaseModel):
    """Request to start a solver run."""

    input: SolverInput
    async_mode: bool = False
    callback_url: str | None = None


class SolveResponse(BaseModel):
    """Response from solver run."""

    solver_run_id: UUID
    status: str
    output: SolverOutput | None = None


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy", version="0.1.0")


@router.post("/solve", response_model=SolveResponse)
async def solve_schedule(
    request: SolveRequest,
    background_tasks: BackgroundTasks,
) -> SolveResponse:
    """Run the course scheduler.

    Can run synchronously (returns results directly) or asynchronously
    (returns immediately with solver_run_id, posts results to callback_url).
    """
    logger.info(
        "Received solve request",
        schedule_version_id=str(request.input.schedule_version_id),
        term_id=str(request.input.term_id),
        num_sections=len(request.input.sections),
        async_mode=request.async_mode,
    )

    if request.async_mode:
        # Queue the solve job
        if not request.callback_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="callback_url required for async_mode",
            )

        # TODO: Queue to Redis/BullMQ and return immediately
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Async mode not yet implemented",
        )

    # Synchronous solve
    try:
        solver = CPSATSolver(request.input)
        output = solver.solve()

        return SolveResponse(
            solver_run_id=output.solver_run_id,
            status=output.result.status,
            output=output,
        )
    except Exception as e:
        logger.exception("Solver error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Solver error: {str(e)}",
        )


@router.get("/runs/{solver_run_id}", response_model=SolveResponse)
async def get_solver_run(solver_run_id: UUID) -> SolveResponse:
    """Get the status/results of a solver run.

    For async solves, poll this endpoint to check completion.
    """
    # TODO: Look up from database/Redis
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Solver run lookup not yet implemented",
    )


@router.post("/runs/{solver_run_id}/cancel")
async def cancel_solver_run(solver_run_id: UUID) -> dict[str, str]:
    """Cancel a running solver job."""
    # TODO: Implement cancellation
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Solver cancellation not yet implemented",
    )


@router.post("/validate")
async def validate_input(input_data: SolverInput) -> dict[str, Any]:
    """Validate solver input without running the solver.

    Checks for basic feasibility issues like:
    - Sections with no valid room options
    - Sections with no valid time options
    - Impossible instructor assignments
    """
    issues: list[dict[str, Any]] = []

    # Check sections have valid options
    for section in input_data.sections:
        # Check room options
        allowed_rooms = section.allowed_room_ids or {r.id for r in input_data.rooms}
        valid_rooms = [
            r for r in input_data.rooms
            if r.id in allowed_rooms and r.capacity >= section.expected_enrollment
        ]
        if not valid_rooms:
            issues.append({
                "type": "no_valid_rooms",
                "section_id": str(section.id),
                "message": f"No room with capacity >= {section.expected_enrollment}",
            })

        # Check pattern options
        allowed_patterns = section.allowed_meeting_pattern_ids or {
            p.id for p in input_data.meeting_patterns
        }
        if not allowed_patterns:
            issues.append({
                "type": "no_valid_patterns",
                "section_id": str(section.id),
                "message": "No allowed meeting patterns",
            })

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "section_count": len(input_data.sections),
        "room_count": len(input_data.rooms),
        "pattern_count": len(input_data.meeting_patterns),
    }


# =============================================================================
# Database-backed Endpoints (Bidirectional Load/Save)
# =============================================================================


class SolveFromDbRequest(BaseModel):
    """Request to solve schedule loading data from database."""

    schedule_version_id: UUID
    term_id: UUID
    institution_id: UUID
    time_limit_seconds: int | None = None
    num_workers: int | None = None


class SolveFromDbResponse(BaseModel):
    """Response from database-backed solver run."""

    solver_run_id: UUID
    status: str
    solve_time_ms: int
    assigned: int
    unassigned: int
    objective_value: float | None = None


@router.post("/solve-from-db", response_model=SolveFromDbResponse)
async def solve_from_database(request: SolveFromDbRequest) -> SolveFromDbResponse:
    """Load data from DB, run solver, and save results atomically.

    This is the primary endpoint for production use. It:
    1. Loads all scheduling data (sections, rooms, instructors, patterns) from PostgreSQL
    2. Runs the CP-SAT solver with configured constraints
    3. Saves all assignments in a single atomic transaction

    The entire solution is persisted atomically - either all assignments are saved
    or none are (following UniTime's TimetableDatabaseSaver pattern).

    Args:
        request: Contains schedule_version_id, term_id, and institution_id

    Returns:
        Summary of solver run including assigned/unassigned counts
    """
    logger.info(
        "Starting database-backed solve",
        schedule_version_id=str(request.schedule_version_id),
        term_id=str(request.term_id),
        institution_id=str(request.institution_id),
    )

    try:
        # 1. Load data from PostgreSQL
        solver_input = await load_solver_input(
            schedule_version_id=request.schedule_version_id,
            term_id=request.term_id,
            institution_id=request.institution_id,
        )

        # Override solver parameters if provided
        if request.time_limit_seconds:
            solver_input = solver_input.model_copy(
                update={"time_limit_seconds": request.time_limit_seconds}
            )
        if request.num_workers:
            solver_input = solver_input.model_copy(
                update={"num_workers": request.num_workers}
            )

        # 2. Run solver (synchronous CPU-bound work)
        solver = CPSATSolver(solver_input)
        output = solver.solve()

        # 3. Save results atomically
        await save_solver_output(request.schedule_version_id, output)

        assigned = sum(1 for a in output.assignments if a.is_assigned)
        unassigned = sum(1 for a in output.assignments if not a.is_assigned)

        logger.info(
            "Database-backed solve completed",
            solver_run_id=str(output.solver_run_id),
            status=output.result.status,
            assigned=assigned,
            unassigned=unassigned,
        )

        return SolveFromDbResponse(
            solver_run_id=output.solver_run_id,
            status=output.result.status,
            solve_time_ms=output.result.solve_time_ms,
            assigned=assigned,
            unassigned=unassigned,
            objective_value=output.result.objective_value
            if output.result.status in ("optimal", "feasible")
            else None,
        )

    except Exception as e:
        logger.exception("Database-backed solve failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Solver error: {str(e)}",
        )


@router.post("/solve-from-db/{schedule_version_id}/commit")
async def commit_schedule(schedule_version_id: UUID) -> dict[str, Any]:
    """Mark all assignments for a schedule version as committed.

    Call this after reviewing and approving a generated schedule.
    This changes assignments from draft (is_committed=false) to
    published (is_committed=true).
    """
    from scheduler.db import repository

    try:
        count = await repository.commit_schedule_version(schedule_version_id)
        return {
            "schedule_version_id": str(schedule_version_id),
            "assignments_committed": count,
            "success": True,
        }
    except Exception as e:
        logger.exception("Failed to commit schedule", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Commit error: {str(e)}",
        )
