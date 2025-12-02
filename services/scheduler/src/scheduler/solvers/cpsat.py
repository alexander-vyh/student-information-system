"""CP-SAT solver implementation for course scheduling.

Uses Google OR-Tools CP-SAT solver with configurable constraints.
"""

import time
from collections import defaultdict
from typing import Any
from uuid import UUID, uuid4

import structlog
from ortools.sat.python import cp_model

from scheduler.constraints.hard import (
    add_cross_list_constraints,
    add_instructor_conflict_constraints,
    add_linked_section_constraints,
    add_room_capacity_constraints,
    add_room_conflict_constraints,
    add_room_feature_constraints,
)
from scheduler.constraints.soft import (
    add_instructor_preference_penalties,
    add_instructor_workload_penalties,
    add_room_preference_penalties,
    add_time_preference_penalties,
)
from scheduler.models import (
    Assignment,
    MeetingPattern,
    PreferenceLevel,
    Room,
    Section,
    SolverInput,
    SolverOutput,
    SolverResult,
)

logger = structlog.get_logger(__name__)


class CPSATSolver:
    """Course scheduling solver using OR-Tools CP-SAT.

    The solver creates decision variables for:
    - section_pattern[section_id, pattern_id]: bool - section uses this meeting pattern
    - section_room[section_id, room_id]: bool - section uses this room
    - section_room_pattern[section_id, room_id, pattern_id]: bool - combined assignment
    - section_instructor[section_id, instructor_id]: bool - instructor teaches section

    Hard constraints ensure:
    - Each section is assigned exactly one pattern
    - Each section is assigned exactly one room
    - No room double-booking
    - No instructor double-booking
    - Room capacity meets section enrollment
    - Room has required features
    - Cross-listed sections meet at same time/room
    - Linked sections have proper timing relationships

    Soft constraints minimize:
    - Instructor time preference violations
    - Room preference violations
    - Instructor workload imbalance
    """

    def __init__(self, solver_input: SolverInput):
        """Initialize solver with input data."""
        self.input = solver_input
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Decision variables
        self.section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar] = {}
        self.section_room_vars: dict[tuple[UUID, UUID], cp_model.IntVar] = {}
        self.section_room_pattern_vars: dict[
            tuple[UUID, UUID, UUID], cp_model.IntVar
        ] = {}
        self.section_instructor_vars: dict[tuple[UUID, UUID], cp_model.IntVar] = {}

        # Lookup tables
        self.pattern_by_id = {p.id: p for p in solver_input.meeting_patterns}
        self.room_by_id = {r.id: r for r in solver_input.rooms}
        self.instructor_by_id = {i.id: i for i in solver_input.instructors}
        self.section_by_id = {s.id: s for s in solver_input.sections}
        self.course_by_id = {c.id: c for c in solver_input.courses}

        # Build course -> required features lookup
        self.course_features: dict[UUID, set[UUID]] = {
            c.id: set(c.required_room_features) for c in solver_input.courses
        }

        # Track violations for reporting
        self.violations: list[dict[str, Any]] = []

    def _create_variables(self) -> None:
        """Create all decision variables."""
        logger.info("Creating decision variables", num_sections=len(self.input.sections))

        for section in self.input.sections:
            # Get allowed patterns (or all if not specified)
            allowed_patterns = (
                set(section.allowed_meeting_pattern_ids)
                if section.allowed_meeting_pattern_ids
                else {p.id for p in self.input.meeting_patterns}
            )

            # Get allowed rooms (or all if not specified)
            allowed_rooms = (
                set(section.allowed_room_ids)
                if section.allowed_room_ids
                else {r.id for r in self.input.rooms}
            )

            # Create pattern variables
            for pattern_id in allowed_patterns:
                if section.fixed_meeting_pattern_id:
                    # Fixed pattern - create constant
                    var = self.model.NewConstant(
                        1 if pattern_id == section.fixed_meeting_pattern_id else 0
                    )
                else:
                    var = self.model.NewBoolVar(f"sp_{section.id}_{pattern_id}")
                self.section_pattern_vars[(section.id, pattern_id)] = var

            # Create room variables
            for room_id in allowed_rooms:
                if section.fixed_room_id:
                    var = self.model.NewConstant(
                        1 if room_id == section.fixed_room_id else 0
                    )
                else:
                    var = self.model.NewBoolVar(f"sr_{section.id}_{room_id}")
                self.section_room_vars[(section.id, room_id)] = var

            # Create combined room-pattern variables for conflict detection
            for pattern_id in allowed_patterns:
                for room_id in allowed_rooms:
                    var = self.model.NewBoolVar(
                        f"srp_{section.id}_{room_id}_{pattern_id}"
                    )
                    self.section_room_pattern_vars[
                        (section.id, room_id, pattern_id)
                    ] = var

                    # Link to individual variables
                    pattern_var = self.section_pattern_vars.get((section.id, pattern_id))
                    room_var = self.section_room_vars.get((section.id, room_id))
                    if pattern_var is not None and room_var is not None:
                        # var = pattern_var AND room_var
                        self.model.AddMultiplicationEquality(
                            var, [pattern_var, room_var]
                        )

            # Create instructor assignment variables
            # For pre-assigned instructors, don't create variables
            potential_instructors = set(section.preferred_instructor_ids) - set(
                section.assigned_instructor_ids
            )
            for instructor_id in potential_instructors:
                var = self.model.NewBoolVar(f"si_{section.id}_{instructor_id}")
                self.section_instructor_vars[(section.id, instructor_id)] = var

        logger.info(
            "Variables created",
            pattern_vars=len(self.section_pattern_vars),
            room_vars=len(self.section_room_vars),
            combined_vars=len(self.section_room_pattern_vars),
            instructor_vars=len(self.section_instructor_vars),
        )

    def _add_assignment_constraints(self) -> None:
        """Add constraints ensuring each section gets exactly one assignment."""
        for section in self.input.sections:
            # Exactly one pattern
            pattern_vars = [
                self.section_pattern_vars[(section.id, p.id)]
                for p in self.input.meeting_patterns
                if (section.id, p.id) in self.section_pattern_vars
            ]
            if pattern_vars:
                self.model.AddExactlyOne(pattern_vars)

            # Exactly one room
            room_vars = [
                self.section_room_vars[(section.id, r.id)]
                for r in self.input.rooms
                if (section.id, r.id) in self.section_room_vars
            ]
            if room_vars:
                self.model.AddExactlyOne(room_vars)

            # At most one instructor assignment (if not pre-assigned)
            if not section.assigned_instructor_ids:
                instructor_vars = [
                    self.section_instructor_vars[(section.id, i_id)]
                    for i_id in section.preferred_instructor_ids
                    if (section.id, i_id) in self.section_instructor_vars
                ]
                if instructor_vars:
                    self.model.AddAtMostOne(instructor_vars)

    def _add_hard_constraints(self) -> None:
        """Add all hard constraints."""
        logger.info("Adding hard constraints")

        # Room conflicts
        add_room_conflict_constraints(
            self.model,
            self.input.sections,
            self.input.rooms,
            self.input.meeting_patterns,
            self.section_room_pattern_vars,
        )

        # Instructor conflicts
        add_instructor_conflict_constraints(
            self.model,
            self.input.sections,
            self.input.meeting_patterns,
            self.section_pattern_vars,
            self.section_instructor_vars,
        )

        # Room capacity
        add_room_capacity_constraints(
            self.model,
            self.input.sections,
            self.input.rooms,
            self.section_room_vars,
        )

        # Room features
        add_room_feature_constraints(
            self.model,
            self.input.sections,
            self.input.rooms,
            self.course_features,
            self.section_room_vars,
        )

        # Cross-listed sections (same time/room)
        add_cross_list_constraints(
            self.model,
            self.input.sections,
            self.section_pattern_vars,
            self.section_room_vars,
        )

        # Linked sections (timing relationships)
        add_linked_section_constraints(
            self.model,
            self.input.sections,
            self.input.meeting_patterns,
            self.section_pattern_vars,
            link_connector_type=self.input.constraint_options.get(
                "link_connector_type", "immediately_after"
            ),
        )

    def _add_soft_constraints(self) -> list[Any]:
        """Add soft constraints and return penalty terms for objective."""
        logger.info("Adding soft constraints")
        penalties: list[Any] = []
        weights = self.input.constraint_weights

        # Instructor time preferences
        penalties.extend(
            add_instructor_preference_penalties(
                self.model,
                self.input.sections,
                self.input.instructors,
                self.input.meeting_patterns,
                self.section_pattern_vars,
                self.section_instructor_vars,
                weights,
            )
        )

        # Time preferences (section-level) - placeholder for now
        # penalties.extend(add_time_preference_penalties(...))

        # Room preferences - placeholder for now
        # penalties.extend(add_room_preference_penalties(...))

        # Instructor workload
        penalties.extend(
            add_instructor_workload_penalties(
                self.model,
                self.input.sections,
                self.input.instructors,
                self.section_instructor_vars,
                weights,
            )
        )

        return penalties

    def _extract_solution(self) -> list[Assignment]:
        """Extract assignments from solved model."""
        assignments: list[Assignment] = []

        for section in self.input.sections:
            assigned_pattern_id: UUID | None = None
            assigned_room_id: UUID | None = None
            assigned_instructors: list[UUID] = list(section.assigned_instructor_ids)
            penalty = 0.0

            # Find assigned pattern
            for pattern in self.input.meeting_patterns:
                key = (section.id, pattern.id)
                if key in self.section_pattern_vars:
                    if self.solver.Value(self.section_pattern_vars[key]) == 1:
                        assigned_pattern_id = pattern.id
                        break

            # Find assigned room
            for room in self.input.rooms:
                key = (section.id, room.id)
                if key in self.section_room_vars:
                    if self.solver.Value(self.section_room_vars[key]) == 1:
                        assigned_room_id = room.id
                        break

            # Find assigned instructors (from decision variables)
            for instructor in self.input.instructors:
                key = (section.id, instructor.id)
                if key in self.section_instructor_vars:
                    if self.solver.Value(self.section_instructor_vars[key]) == 1:
                        assigned_instructors.append(instructor.id)

            is_assigned = assigned_pattern_id is not None and assigned_room_id is not None
            unassigned_reason = None if is_assigned else "No feasible assignment found"

            # Get default date pattern (use first one for now)
            date_pattern_id = (
                self.input.date_patterns[0].id if self.input.date_patterns else None
            )
            if section.fixed_date_pattern_id:
                date_pattern_id = section.fixed_date_pattern_id

            assignments.append(
                Assignment(
                    section_id=section.id,
                    meeting_pattern_id=assigned_pattern_id,
                    date_pattern_id=date_pattern_id,
                    room_id=assigned_room_id,
                    instructor_ids=tuple(assigned_instructors),
                    penalty_contribution=penalty,
                    is_assigned=is_assigned,
                    unassigned_reason=unassigned_reason,
                )
            )

        return assignments

    def solve(self) -> SolverOutput:
        """Run the solver and return results."""
        solver_run_id = uuid4()
        start_time = time.time()

        logger.info(
            "Starting solver",
            solver_run_id=str(solver_run_id),
            num_sections=len(self.input.sections),
            num_patterns=len(self.input.meeting_patterns),
            num_rooms=len(self.input.rooms),
            num_instructors=len(self.input.instructors),
        )

        # Build the model
        self._create_variables()
        self._add_assignment_constraints()
        self._add_hard_constraints()
        penalties = self._add_soft_constraints()

        # Set objective: minimize total penalty
        if penalties:
            self.model.Minimize(sum(penalties))

        # Configure solver
        self.solver.parameters.max_time_in_seconds = self.input.time_limit_seconds
        self.solver.parameters.num_workers = self.input.num_workers
        self.solver.parameters.log_search_progress = self.input.log_progress

        # Solve
        status = self.solver.Solve(self.model)
        solve_time_ms = int((time.time() - start_time) * 1000)

        # Map status
        status_map = {
            cp_model.OPTIMAL: "optimal",
            cp_model.FEASIBLE: "feasible",
            cp_model.INFEASIBLE: "infeasible",
            cp_model.MODEL_INVALID: "error",
            cp_model.UNKNOWN: "timeout",
        }
        status_str = status_map.get(status, "unknown")

        logger.info(
            "Solver completed",
            status=status_str,
            solve_time_ms=solve_time_ms,
            objective=self.solver.ObjectiveValue() if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else None,
        )

        # Extract solution if feasible
        assignments: list[Assignment] = []
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            assignments = self._extract_solution()

        # Build result
        result = SolverResult(
            status=status_str,
            solve_time_ms=solve_time_ms,
            objective_value=float(self.solver.ObjectiveValue())
            if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]
            else 0.0,
            branches=self.solver.NumBranches(),
            conflicts=self.solver.NumConflicts(),
            iterations=0,  # Not directly available in CP-SAT
        )

        return SolverOutput(
            solver_run_id=solver_run_id,
            result=result,
            assignments=assignments,
            violations=self.violations,
            statistics={
                "num_variables": self.model.Proto().variables.__len__(),
                "num_constraints": self.model.Proto().constraints.__len__(),
                "assigned_sections": sum(1 for a in assignments if a.is_assigned),
                "unassigned_sections": sum(1 for a in assignments if not a.is_assigned),
            },
        )


def solve_schedule(solver_input: SolverInput) -> SolverOutput:
    """Convenience function to solve a scheduling problem."""
    solver = CPSATSolver(solver_input)
    return solver.solve()
