"""Soft constraints that contribute to optimization objective.

These constraints add penalties to the objective function when violated.
The solver attempts to minimize total penalty.
"""

from collections import defaultdict
from datetime import time
from uuid import UUID

from ortools.sat.python import cp_model

from scheduler.models import (
    Instructor,
    InstructorPreference,
    MeetingPattern,
    PreferenceLevel,
    Room,
    Section,
)


def _time_in_range(check_time: time, start: time, end: time) -> bool:
    """Check if a time falls within a range."""
    return start <= check_time < end


def _pattern_matches_preference(
    pattern: MeetingPattern, pref: InstructorPreference
) -> bool:
    """Check if a meeting pattern matches a preference."""
    if pref.meeting_pattern_id is not None:
        return pattern.id == pref.meeting_pattern_id

    # Check day/time overlap
    for meeting_time in pattern.times:
        # Day check
        if pref.day_of_week is not None and meeting_time.day_of_week != pref.day_of_week:
            continue

        # Time range check
        if pref.start_time is not None and pref.end_time is not None:
            if _time_in_range(meeting_time.start_time, pref.start_time, pref.end_time):
                return True
            if _time_in_range(meeting_time.end_time, pref.start_time, pref.end_time):
                return True
        elif pref.day_of_week is not None:
            # Preference for entire day
            return True

    return False


def add_instructor_preference_penalties(
    model: cp_model.CpModel,
    sections: list[Section],
    instructors: list[Instructor],
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_instructor_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    weights: dict[str, float],
) -> list[cp_model.IntVar]:
    """Add penalties for violating instructor time preferences.

    Returns list of penalty variables to add to objective.
    """
    penalties: list[cp_model.IntVar] = []
    base_weight = int(weights.get("instructor_time_preference", 10))
    instructor_by_id = {i.id: i for i in instructors}

    for section in sections:
        # Get assigned or potential instructors
        instructor_ids = set(section.assigned_instructor_ids) | set(
            section.preferred_instructor_ids
        )

        for instructor_id in instructor_ids:
            instructor = instructor_by_id.get(instructor_id)
            if not instructor or not instructor.time_preferences:
                continue

            for pattern in meeting_patterns:
                pattern_var = section_pattern_vars.get((section.id, pattern.id))
                if pattern_var is None:
                    continue

                instructor_var = section_instructor_vars.get((section.id, instructor_id))

                for pref in instructor.time_preferences:
                    if not _pattern_matches_preference(pattern, pref):
                        continue

                    # Calculate penalty based on preference level
                    penalty_value = 0
                    if pref.preference_level == PreferenceLevel.PROHIBITED:
                        # Should be handled as hard constraint, but add huge penalty
                        penalty_value = base_weight * 100
                    elif pref.preference_level == PreferenceLevel.DISCOURAGED:
                        penalty_value = base_weight * 2
                    elif pref.preference_level == PreferenceLevel.PREFERRED:
                        penalty_value = -base_weight  # Reward
                    elif pref.preference_level == PreferenceLevel.REQUIRED:
                        # Should be hard constraint, add reward for compliance
                        penalty_value = -base_weight * 2

                    if penalty_value == 0:
                        continue

                    # Create penalty variable
                    penalty_var = model.NewBoolVar(
                        f"pref_penalty_{section.id}_{instructor_id}_{pattern.id}"
                    )

                    if instructor_var is not None:
                        # Penalty applies when both pattern and instructor are assigned
                        model.AddMultiplicationEquality(
                            penalty_var, [pattern_var, instructor_var]
                        )
                    elif instructor_id in section.assigned_instructor_ids:
                        # Instructor pre-assigned, penalty depends only on pattern
                        model.Add(penalty_var == pattern_var)

                    penalties.append(penalty_var * penalty_value)

    return penalties


def add_time_preference_penalties(
    model: cp_model.CpModel,
    sections: list[Section],
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_time_prefs: dict[UUID, dict[UUID, PreferenceLevel]],  # section -> pattern -> pref
    weights: dict[str, float],
) -> list[cp_model.IntVar]:
    """Add penalties for section time preferences."""
    penalties: list[cp_model.IntVar] = []
    base_weight = int(weights.get("section_time_preference", 5))

    for section in sections:
        prefs = section_time_prefs.get(section.id, {})
        if not prefs:
            continue

        for pattern_id, pref_level in prefs.items():
            pattern_var = section_pattern_vars.get((section.id, pattern_id))
            if pattern_var is None:
                continue

            penalty_value = 0
            if pref_level == PreferenceLevel.DISCOURAGED:
                penalty_value = base_weight
            elif pref_level == PreferenceLevel.PREFERRED:
                penalty_value = -base_weight

            if penalty_value != 0:
                penalties.append(pattern_var * penalty_value)

    return penalties


def add_room_preference_penalties(
    model: cp_model.CpModel,
    sections: list[Section],
    rooms: list[Room],
    section_room_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_room_prefs: dict[UUID, dict[UUID, PreferenceLevel]],  # section -> room -> pref
    weights: dict[str, float],
) -> list[cp_model.IntVar]:
    """Add penalties for section room preferences."""
    penalties: list[cp_model.IntVar] = []
    base_weight = int(weights.get("section_room_preference", 5))

    for section in sections:
        prefs = section_room_prefs.get(section.id, {})
        if not prefs:
            continue

        for room_id, pref_level in prefs.items():
            room_var = section_room_vars.get((section.id, room_id))
            if room_var is None:
                continue

            penalty_value = 0
            if pref_level == PreferenceLevel.DISCOURAGED:
                penalty_value = base_weight
            elif pref_level == PreferenceLevel.PREFERRED:
                penalty_value = -base_weight

            if penalty_value != 0:
                penalties.append(room_var * penalty_value)

    return penalties


def add_instructor_workload_penalties(
    model: cp_model.CpModel,
    sections: list[Section],
    instructors: list[Instructor],
    section_instructor_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    weights: dict[str, float],
) -> list[cp_model.IntVar]:
    """Add penalties for instructor workload imbalance.

    Penalizes deviation from target load and violations of min/max load.
    """
    penalties: list[cp_model.IntVar] = []
    underload_weight = int(weights.get("instructor_underload", 20))
    overload_weight = int(weights.get("instructor_overload", 50))
    target_weight = int(weights.get("instructor_target_deviation", 5))

    # Assume 1 credit hour = 1 load unit for simplicity
    section_loads = {s.id: s.credit_hours for s in sections}

    for instructor in instructors:
        # Calculate total load for this instructor
        instructor_sections: list[tuple[UUID, cp_model.IntVar | int]] = []

        for section in sections:
            key = (section.id, instructor.id)
            if key in section_instructor_vars:
                instructor_sections.append(
                    (section.id, section_instructor_vars[key])
                )
            elif instructor.id in section.assigned_instructor_ids:
                instructor_sections.append((section.id, 1))

        if not instructor_sections:
            continue

        # Scale credit hours to integers (multiply by 10 for precision)
        # This avoids float arithmetic issues with CP-SAT
        section_loads_scaled = {
            sid: int(section_loads[sid] * 10) for sid, _ in instructor_sections
        }

        # Calculate total load as a linear expression
        max_possible_load = sum(section_loads_scaled.values())
        total_load = model.NewIntVar(0, max_possible_load, f"load_{instructor.id}")

        # Build the constraint: total_load == sum(load * is_assigned)
        load_terms = []
        for sid, var in instructor_sections:
            scaled_load = section_loads_scaled[sid]
            if isinstance(var, int):
                # Pre-assigned instructor: always contributes this load
                load_terms.append(scaled_load * var)
            else:
                # Decision variable: contributes load only if assigned
                load_terms.append(scaled_load * var)

        if load_terms:
            model.Add(total_load == sum(load_terms))

        # Min load violation
        if instructor.min_load > 0:
            min_threshold = int(instructor.min_load * 10)
            underload = model.NewIntVar(0, min_threshold, f"underload_{instructor.id}")
            model.Add(underload >= min_threshold - total_load)
            model.Add(underload >= 0)
            penalties.append(underload * underload_weight)

        # Max load violation
        max_threshold = int(instructor.max_load * 10)
        overload = model.NewIntVar(0, int(max_possible_load * 10), f"overload_{instructor.id}")
        model.Add(overload >= total_load - max_threshold)
        model.Add(overload >= 0)
        penalties.append(overload * overload_weight)

        # Target deviation
        if instructor.target_load is not None:
            target = int(instructor.target_load * 10)
            deviation = model.NewIntVar(
                0, int(max_possible_load * 10), f"target_dev_{instructor.id}"
            )
            # |total_load - target|
            model.AddAbsEquality(deviation, total_load - target)
            penalties.append(deviation * target_weight)

    return penalties


def add_back_to_back_penalty(
    model: cp_model.CpModel,
    sections: list[Section],
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_instructor_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    weights: dict[str, float],
) -> list[cp_model.IntVar]:
    """Add penalties for back-to-back classes in different buildings.

    This is a soft constraint to allow instructors travel time between buildings.
    """
    penalties: list[cp_model.IntVar] = []
    base_weight = int(weights.get("back_to_back_penalty", 15))

    # TODO: Implement building-aware back-to-back detection
    # This requires room building information and pattern adjacency analysis

    return penalties
