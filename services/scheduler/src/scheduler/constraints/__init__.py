"""Constraint definitions for course scheduling optimization.

Constraints are categorized as:
- Hard constraints: Must be satisfied (infeasible if violated)
- Soft constraints: Should be satisfied (penalty if violated)
- Distribution constraints: Spread/balance requirements

Based on UniTime constraint model with institution-configurable weights.
"""

from scheduler.constraints.hard import (
    add_cross_list_constraints,
    add_instructor_conflict_constraints,
    add_linked_section_constraints,
    add_room_capacity_constraints,
    add_room_conflict_constraints,
    add_room_feature_constraints,
)
from scheduler.constraints.soft import (
    add_back_to_back_penalty,
    add_instructor_preference_penalties,
    add_instructor_workload_penalties,
    add_room_preference_penalties,
    add_time_preference_penalties,
)

__all__ = [
    # Hard constraints
    "add_cross_list_constraints",
    "add_instructor_conflict_constraints",
    "add_linked_section_constraints",
    "add_room_capacity_constraints",
    "add_room_conflict_constraints",
    "add_room_feature_constraints",
    # Soft constraints
    "add_back_to_back_penalty",
    "add_instructor_preference_penalties",
    "add_instructor_workload_penalties",
    "add_room_preference_penalties",
    "add_time_preference_penalties",
]
