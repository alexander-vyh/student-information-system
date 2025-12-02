"""Domain models for course scheduling optimization.

These models are designed to be:
1. Serializable for API transport
2. Hashable for use in constraint programming
3. Immutable during solver execution
"""

from datetime import date, time
from enum import IntEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field


class PreferenceLevel(IntEnum):
    """Preference levels following UniTime model (-2 to +2)."""

    PROHIBITED = -2  # Hard constraint: must not happen
    DISCOURAGED = -1  # Soft constraint: penalty if chosen
    NEUTRAL = 0  # No preference
    PREFERRED = 1  # Soft constraint: reward if chosen
    REQUIRED = 2  # Hard constraint: must happen


class MeetingTime(BaseModel, frozen=True):
    """A single day/time occurrence within a meeting pattern."""

    day_of_week: Annotated[int, Field(ge=0, le=6)]  # 0=Sun, 6=Sat
    start_time: time
    end_time: time
    break_minutes: int = 0


class MeetingPattern(BaseModel, frozen=True):
    """A reusable meeting pattern (e.g., MWF 9:00-9:50)."""

    id: UUID
    name: str
    code: str | None = None
    times: tuple[MeetingTime, ...]
    total_minutes_per_week: int
    pattern_type: str | None = None  # standard, evening, weekend


class DatePattern(BaseModel, frozen=True):
    """Academic calendar pattern for a section."""

    id: UUID
    name: str
    first_date: date
    last_date: date
    pattern_type: str | None = None  # full_term, first_half, second_half


class RoomFeature(BaseModel, frozen=True):
    """A feature available in a room."""

    id: UUID
    code: str
    name: str
    quantity: int = 1


class Room(BaseModel, frozen=True):
    """A schedulable room."""

    id: UUID
    code: str  # Building + Room number
    name: str | None = None
    capacity: int
    building_id: UUID
    features: frozenset[RoomFeature] = frozenset()
    is_schedulable: bool = True


class InstructorPreference(BaseModel, frozen=True):
    """Time preference for an instructor."""

    day_of_week: int | None = None  # None = all days
    start_time: time | None = None
    end_time: time | None = None
    meeting_pattern_id: UUID | None = None
    preference_level: PreferenceLevel = PreferenceLevel.NEUTRAL


class Instructor(BaseModel, frozen=True):
    """An instructor with workload and preferences."""

    id: UUID
    name: str
    min_load: float = 0.0
    max_load: float
    target_load: float | None = None
    max_courses: int | None = None
    max_preps: int | None = None  # Distinct course preparations
    time_preferences: tuple[InstructorPreference, ...] = ()
    qualified_course_ids: frozenset[UUID] = frozenset()


class Course(BaseModel, frozen=True):
    """A course definition."""

    id: UUID
    code: str  # e.g., "CS 101"
    name: str
    credit_hours: float
    required_room_features: frozenset[UUID] = frozenset()


class Section(BaseModel, frozen=True):
    """A section to be scheduled."""

    id: UUID
    course_id: UUID
    section_number: str
    expected_enrollment: int
    credit_hours: float

    # Scheduling constraints
    allowed_meeting_pattern_ids: frozenset[UUID] | None = None  # None = all allowed
    allowed_room_ids: frozenset[UUID] | None = None  # None = all allowed
    required_room_features: frozenset[UUID] = frozenset()

    # Instructor preferences
    preferred_instructor_ids: tuple[UUID, ...] = ()
    assigned_instructor_ids: tuple[UUID, ...] = ()  # Pre-assigned

    # Linking
    cross_list_group_id: UUID | None = None
    link_group_id: UUID | None = None
    is_link_parent: bool = False

    # Manual overrides
    fixed_meeting_pattern_id: UUID | None = None
    fixed_room_id: UUID | None = None
    fixed_date_pattern_id: UUID | None = None


class TimeSlot(BaseModel, frozen=True):
    """A specific time slot for scheduling (meeting pattern + date pattern)."""

    meeting_pattern_id: UUID
    date_pattern_id: UUID


class Assignment(BaseModel, frozen=True):
    """A scheduling assignment for a section."""

    section_id: UUID
    meeting_pattern_id: UUID | None = None
    date_pattern_id: UUID | None = None
    room_id: UUID | None = None
    instructor_ids: tuple[UUID, ...] = ()
    penalty_contribution: float = 0.0
    is_assigned: bool = True
    unassigned_reason: str | None = None


class SolverInput(BaseModel):
    """Input data for the solver."""

    schedule_version_id: UUID
    term_id: UUID
    institution_id: UUID

    # Reference data
    meeting_patterns: list[MeetingPattern]
    date_patterns: list[DatePattern]
    rooms: list[Room]
    instructors: list[Instructor]
    courses: list[Course]

    # Sections to schedule
    sections: list[Section]

    # Constraint weights (institution-configurable)
    constraint_weights: dict[str, float] = Field(default_factory=dict)

    # Constraint options (non-numeric settings)
    constraint_options: dict[str, str] = Field(default_factory=dict)

    # Solver parameters
    time_limit_seconds: int = 300
    num_workers: int = 4
    log_progress: bool = False


class SolverResult(BaseModel):
    """Result status from the solver."""

    status: str  # "optimal", "feasible", "infeasible", "timeout", "error"
    solve_time_ms: int
    objective_value: float
    branches: int = 0
    conflicts: int = 0
    iterations: int = 0


class SolverOutput(BaseModel):
    """Output from the solver."""

    solver_run_id: UUID
    result: SolverResult
    assignments: list[Assignment]
    violations: list[dict]  # Constraint violations with details
    statistics: dict = Field(default_factory=dict)
