"""Hard constraints that must be satisfied for a valid schedule.

These constraints result in infeasibility if violated.
"""

from collections import defaultdict
from uuid import UUID

from ortools.sat.python import cp_model

from scheduler.models import MeetingPattern, Room, Section, SolverInput


def _patterns_overlap(p1: MeetingPattern, p2: MeetingPattern) -> bool:
    """Check if two meeting patterns have any time overlap."""
    for t1 in p1.times:
        for t2 in p2.times:
            if t1.day_of_week != t2.day_of_week:
                continue
            # Check time overlap on same day
            if t1.start_time < t2.end_time and t2.start_time < t1.end_time:
                return True
    return False


def add_room_conflict_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    rooms: list[Room],
    meeting_patterns: list[MeetingPattern],
    section_room_pattern_vars: dict[tuple[UUID, UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraints to prevent room double-booking.

    A room can only be assigned to one section at any given time.
    """
    # Build pattern overlap matrix
    pattern_by_id = {p.id: p for p in meeting_patterns}
    overlapping_patterns: dict[UUID, set[UUID]] = defaultdict(set)

    for p1 in meeting_patterns:
        for p2 in meeting_patterns:
            if p1.id != p2.id and _patterns_overlap(p1, p2):
                overlapping_patterns[p1.id].add(p2.id)

    # For each room, sections with overlapping patterns can't all be assigned
    for room in rooms:
        room_id = room.id

        # Group variables by pattern
        room_section_by_pattern: dict[UUID, list[cp_model.IntVar]] = defaultdict(list)

        for section in sections:
            for pattern in meeting_patterns:
                key = (section.id, room_id, pattern.id)
                if key in section_room_pattern_vars:
                    room_section_by_pattern[pattern.id].append(
                        section_room_pattern_vars[key]
                    )

        # For each pattern, at most one section can use this room at this time
        for pattern_id, pattern_vars in room_section_by_pattern.items():
            if len(pattern_vars) > 1:
                model.Add(sum(pattern_vars) <= 1)

        # For each pair of overlapping patterns, at most one section can use the room
        processed_pairs: set[tuple[UUID, UUID]] = set()

        for pattern_id, overlaps in overlapping_patterns.items():
            for overlap_id in overlaps:
                pair = tuple(sorted([pattern_id, overlap_id]))
                if pair in processed_pairs:
                    continue
                processed_pairs.add(pair)

                vars_p1 = room_section_by_pattern.get(pattern_id, [])
                vars_p2 = room_section_by_pattern.get(overlap_id, [])

                if vars_p1 and vars_p2:
                    # At most one of these can be true
                    model.Add(sum(vars_p1) + sum(vars_p2) <= 1)


def add_instructor_conflict_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_instructor_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraints to prevent instructor double-booking.

    An instructor can only teach one section at any given time.
    """
    pattern_by_id = {p.id: p for p in meeting_patterns}
    overlapping_patterns: dict[UUID, set[UUID]] = defaultdict(set)

    for p1 in meeting_patterns:
        for p2 in meeting_patterns:
            if p1.id != p2.id and _patterns_overlap(p1, p2):
                overlapping_patterns[p1.id].add(p2.id)

    # Get all instructor IDs from section assignments
    all_instructor_ids: set[UUID] = set()
    for section in sections:
        all_instructor_ids.update(section.assigned_instructor_ids)
        all_instructor_ids.update(section.preferred_instructor_ids)

    # For each instructor, check for conflicts
    for instructor_id in all_instructor_ids:
        # Find sections this instructor might teach
        instructor_sections: list[Section] = []
        for section in sections:
            key = (section.id, instructor_id)
            if key in section_instructor_vars or instructor_id in section.assigned_instructor_ids:
                instructor_sections.append(section)

        if len(instructor_sections) < 2:
            continue

        # For each pair of sections, if patterns overlap, both can't be assigned
        for i, s1 in enumerate(instructor_sections):
            for s2 in instructor_sections[i + 1 :]:
                for p1_id in [p.id for p in meeting_patterns]:
                    for p2_id in overlapping_patterns.get(p1_id, set()):
                        # If s1 has pattern p1 and instructor, and s2 has pattern p2 and instructor
                        # then this is a conflict
                        var_s1_p1 = section_pattern_vars.get((s1.id, p1_id))
                        var_s2_p2 = section_pattern_vars.get((s2.id, p2_id))
                        var_s1_inst = section_instructor_vars.get((s1.id, instructor_id))
                        var_s2_inst = section_instructor_vars.get((s2.id, instructor_id))

                        if var_s1_p1 and var_s2_p2:
                            # Both using instructor (or pre-assigned)
                            if var_s1_inst and var_s2_inst:
                                # At most 3 of these 4 can be true
                                model.Add(
                                    var_s1_p1 + var_s2_p2 + var_s1_inst + var_s2_inst <= 3
                                )
                            elif instructor_id in s1.assigned_instructor_ids:
                                # s1 pre-assigned, so s2 can't use overlapping pattern with this instructor
                                model.Add(var_s1_p1 + var_s2_p2 + var_s2_inst <= 2)
                            elif instructor_id in s2.assigned_instructor_ids:
                                model.Add(var_s1_p1 + var_s2_p2 + var_s1_inst <= 2)


def add_room_capacity_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    rooms: list[Room],
    section_room_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraints to ensure room capacity meets section enrollment.

    A section can only be assigned to rooms that can accommodate its expected enrollment.
    """
    room_by_id = {r.id: r for r in rooms}

    for section in sections:
        for room in rooms:
            key = (section.id, room.id)
            if key in section_room_vars:
                if room.capacity < section.expected_enrollment:
                    # Room too small - prohibit assignment
                    model.Add(section_room_vars[key] == 0)


def add_room_feature_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    rooms: list[Room],
    courses: dict[UUID, set[UUID]],  # course_id -> required feature IDs
    section_room_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraints to ensure rooms have required features.

    A section can only be assigned to rooms that have all required features.
    """
    room_by_id = {r.id: r for r in rooms}

    for section in sections:
        # Get required features from section and course
        required_features = set(section.required_room_features)
        course_features = courses.get(section.course_id, set())
        required_features.update(course_features)

        if not required_features:
            continue

        for room in rooms:
            key = (section.id, room.id)
            if key not in section_room_vars:
                continue

            # Check if room has all required features
            room_feature_ids = {f.id for f in room.features}
            missing_features = required_features - room_feature_ids

            if missing_features:
                # Room missing required features - prohibit assignment
                model.Add(section_room_vars[key] == 0)


def add_cross_list_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    section_room_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraints for cross-listed sections.

    Cross-listed sections (e.g., MATH 101 / STAT 101) must:
    1. Meet at the same time (same meeting pattern)
    2. Meet in the same room

    This is modeled by forcing all sections in a cross-list group to have
    identical pattern and room assignments.
    """
    # Group sections by cross-list group
    cross_list_groups: dict[UUID, list[Section]] = defaultdict(list)
    for section in sections:
        if section.cross_list_group_id:
            cross_list_groups[section.cross_list_group_id].append(section)

    for group_id, group_sections in cross_list_groups.items():
        if len(group_sections) < 2:
            continue

        # Use first section as the "anchor" that others must match
        anchor = group_sections[0]

        for other in group_sections[1:]:
            # Constraint: same meeting pattern
            # For each pattern, anchor uses it IFF other uses it
            anchor_pattern_ids = {
                pid for (sid, pid) in section_pattern_vars.keys() if sid == anchor.id
            }
            other_pattern_ids = {
                pid for (sid, pid) in section_pattern_vars.keys() if sid == other.id
            }
            common_patterns = anchor_pattern_ids & other_pattern_ids

            for pattern_id in common_patterns:
                anchor_var = section_pattern_vars.get((anchor.id, pattern_id))
                other_var = section_pattern_vars.get((other.id, pattern_id))
                if anchor_var is not None and other_var is not None:
                    # anchor_var == other_var
                    model.Add(anchor_var == other_var)

            # Constraint: same room
            # For each room, anchor uses it IFF other uses it
            anchor_room_ids = {
                rid for (sid, rid) in section_room_vars.keys() if sid == anchor.id
            }
            other_room_ids = {
                rid for (sid, rid) in section_room_vars.keys() if sid == other.id
            }
            common_rooms = anchor_room_ids & other_room_ids

            for room_id in common_rooms:
                anchor_var = section_room_vars.get((anchor.id, room_id))
                other_var = section_room_vars.get((other.id, room_id))
                if anchor_var is not None and other_var is not None:
                    # anchor_var == other_var
                    model.Add(anchor_var == other_var)


def add_linked_section_constraints(
    model: cp_model.CpModel,
    sections: list[Section],
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
    link_connector_type: str = "immediately_after",
) -> None:
    """Add constraints for linked sections (e.g., lecture + lab).

    Linked sections have timing relationships:
    - "immediately_after": Child must start after parent ends (same day)
    - "same_day": Child must be on the same day(s) as parent
    - "different_day": Child must be on different day(s) than parent

    The parent section (is_link_parent=True) is scheduled first, then
    child sections are constrained relative to it.
    """
    # Group sections by link group
    link_groups: dict[UUID, list[Section]] = defaultdict(list)
    for section in sections:
        if section.link_group_id:
            link_groups[section.link_group_id].append(section)

    pattern_by_id = {p.id: p for p in meeting_patterns}

    for group_id, group_sections in link_groups.items():
        if len(group_sections) < 2:
            continue

        # Find parent section
        parents = [s for s in group_sections if s.is_link_parent]
        children = [s for s in group_sections if not s.is_link_parent]

        if not parents:
            # No explicit parent, use first section
            parents = [group_sections[0]]
            children = group_sections[1:]

        parent = parents[0]

        for child in children:
            if link_connector_type == "immediately_after":
                _add_immediately_after_constraint(
                    model, parent, child, meeting_patterns, section_pattern_vars
                )
            elif link_connector_type == "same_day":
                _add_same_day_constraint(
                    model, parent, child, meeting_patterns, section_pattern_vars
                )
            elif link_connector_type == "different_day":
                _add_different_day_constraint(
                    model, parent, child, meeting_patterns, section_pattern_vars
                )


def _get_pattern_days(pattern: MeetingPattern) -> set[int]:
    """Extract the days of week from a meeting pattern."""
    return {t.day_of_week for t in pattern.times}


def _patterns_compatible_immediately_after(
    parent_pattern: MeetingPattern,
    child_pattern: MeetingPattern,
    max_gap_minutes: int = 30,
) -> bool:
    """Check if child pattern can start immediately after parent on same day.

    Returns True if there exists at least one day where:
    - Both patterns meet
    - Child starts within max_gap_minutes after parent ends
    """
    parent_days = _get_pattern_days(parent_pattern)
    child_days = _get_pattern_days(child_pattern)

    common_days = parent_days & child_days
    if not common_days:
        return False

    for day in common_days:
        parent_times = [t for t in parent_pattern.times if t.day_of_week == day]
        child_times = [t for t in child_pattern.times if t.day_of_week == day]

        for pt in parent_times:
            for ct in child_times:
                # Child should start after parent ends
                parent_end_minutes = pt.end_time.hour * 60 + pt.end_time.minute
                child_start_minutes = ct.start_time.hour * 60 + ct.start_time.minute

                gap = child_start_minutes - parent_end_minutes
                if 0 <= gap <= max_gap_minutes:
                    return True

    return False


def _add_immediately_after_constraint(
    model: cp_model.CpModel,
    parent: Section,
    child: Section,
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraint: child must start immediately after parent ends.

    For each parent pattern assignment, only allow compatible child patterns.
    """
    pattern_by_id = {p.id: p for p in meeting_patterns}

    # Get available patterns for each section
    parent_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == parent.id
    ]
    child_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == child.id
    ]

    # For each parent pattern, find compatible child patterns
    for parent_pid in parent_patterns:
        parent_pattern = pattern_by_id.get(parent_pid)
        if not parent_pattern:
            continue

        parent_var = section_pattern_vars.get((parent.id, parent_pid))
        if parent_var is None:
            continue

        # Find which child patterns are compatible
        compatible_child_pids = []
        for child_pid in child_patterns:
            child_pattern = pattern_by_id.get(child_pid)
            if child_pattern and _patterns_compatible_immediately_after(
                parent_pattern, child_pattern
            ):
                compatible_child_pids.append(child_pid)

        if not compatible_child_pids:
            # No compatible child patterns - this parent pattern is invalid
            model.Add(parent_var == 0)
        else:
            # If parent uses this pattern, child must use one of the compatible ones
            compatible_child_vars = [
                section_pattern_vars[(child.id, cpid)]
                for cpid in compatible_child_pids
                if (child.id, cpid) in section_pattern_vars
            ]
            if compatible_child_vars:
                # parent_var implies at least one compatible child var
                model.Add(sum(compatible_child_vars) >= parent_var)


def _add_same_day_constraint(
    model: cp_model.CpModel,
    parent: Section,
    child: Section,
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraint: child must meet on at least one same day as parent."""
    pattern_by_id = {p.id: p for p in meeting_patterns}

    parent_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == parent.id
    ]
    child_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == child.id
    ]

    for parent_pid in parent_patterns:
        parent_pattern = pattern_by_id.get(parent_pid)
        if not parent_pattern:
            continue

        parent_var = section_pattern_vars.get((parent.id, parent_pid))
        if parent_var is None:
            continue

        parent_days = _get_pattern_days(parent_pattern)

        # Find child patterns that share at least one day
        compatible_child_pids = []
        for child_pid in child_patterns:
            child_pattern = pattern_by_id.get(child_pid)
            if child_pattern:
                child_days = _get_pattern_days(child_pattern)
                if parent_days & child_days:  # At least one common day
                    compatible_child_pids.append(child_pid)

        if compatible_child_pids:
            compatible_child_vars = [
                section_pattern_vars[(child.id, cpid)]
                for cpid in compatible_child_pids
                if (child.id, cpid) in section_pattern_vars
            ]
            if compatible_child_vars:
                model.Add(sum(compatible_child_vars) >= parent_var)


def _add_different_day_constraint(
    model: cp_model.CpModel,
    parent: Section,
    child: Section,
    meeting_patterns: list[MeetingPattern],
    section_pattern_vars: dict[tuple[UUID, UUID], cp_model.IntVar],
) -> None:
    """Add constraint: child must meet on different day(s) than parent."""
    pattern_by_id = {p.id: p for p in meeting_patterns}

    parent_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == parent.id
    ]
    child_patterns = [
        pid for (sid, pid) in section_pattern_vars.keys() if sid == child.id
    ]

    for parent_pid in parent_patterns:
        parent_pattern = pattern_by_id.get(parent_pid)
        if not parent_pattern:
            continue

        parent_var = section_pattern_vars.get((parent.id, parent_pid))
        if parent_var is None:
            continue

        parent_days = _get_pattern_days(parent_pattern)

        # Find child patterns with NO overlap in days
        compatible_child_pids = []
        for child_pid in child_patterns:
            child_pattern = pattern_by_id.get(child_pid)
            if child_pattern:
                child_days = _get_pattern_days(child_pattern)
                if not (parent_days & child_days):  # No common days
                    compatible_child_pids.append(child_pid)

        if compatible_child_pids:
            compatible_child_vars = [
                section_pattern_vars[(child.id, cpid)]
                for cpid in compatible_child_pids
                if (child.id, cpid) in section_pattern_vars
            ]
            if compatible_child_vars:
                model.Add(sum(compatible_child_vars) >= parent_var)
