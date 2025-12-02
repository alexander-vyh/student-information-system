"""Bidirectional repository for scheduler data.

Implements UniTime's TimetableDatabaseLoader/Saver pattern:
- load_solver_input(): Hydrates domain models from PostgreSQL
- save_solver_output(): Persists solver results atomically

All data is loaded in a single operation to minimize round-trips,
and all results are saved in a single transaction to ensure atomicity.
"""

from uuid import UUID

import asyncpg
import structlog

from scheduler.db.connection import get_connection
from scheduler.models import (
    Assignment,
    Course,
    DatePattern,
    Instructor,
    InstructorPreference,
    MeetingPattern,
    MeetingTime,
    PreferenceLevel,
    Room,
    RoomFeature,
    Section,
    SolverInput,
    SolverOutput,
)

logger = structlog.get_logger(__name__)


# =============================================================================
# Data Loader Functions
# =============================================================================


async def load_solver_input(
    schedule_version_id: UUID,
    term_id: UUID,
    institution_id: UUID,
) -> SolverInput:
    """Load all data needed for solver from PostgreSQL.

    This hydrates the complete domain model for the solver in a single
    connection, minimizing network round-trips.

    Args:
        schedule_version_id: The schedule version to load/update
        term_id: Academic term for sections
        institution_id: Institution for reference data

    Returns:
        Fully populated SolverInput ready for the CP-SAT solver
    """
    logger.info(
        "Loading solver input from database",
        schedule_version_id=str(schedule_version_id),
        term_id=str(term_id),
        institution_id=str(institution_id),
    )

    async with get_connection() as conn:
        # Load all data (each function handles its own queries)
        meeting_patterns = await _load_meeting_patterns(conn, institution_id)
        date_patterns = await _load_date_patterns(conn, term_id)
        rooms = await _load_rooms(conn, institution_id)
        instructors = await _load_instructors(conn, institution_id, term_id)
        courses = await _load_courses(conn, institution_id)
        sections = await _load_sections(conn, term_id, schedule_version_id)
        constraint_weights = await _load_constraint_weights(conn, institution_id)
        constraint_options = await _load_constraint_options(conn, institution_id)

        logger.info(
            "Solver input loaded",
            meeting_patterns=len(meeting_patterns),
            date_patterns=len(date_patterns),
            rooms=len(rooms),
            instructors=len(instructors),
            courses=len(courses),
            sections=len(sections),
        )

        return SolverInput(
            schedule_version_id=schedule_version_id,
            term_id=term_id,
            institution_id=institution_id,
            meeting_patterns=meeting_patterns,
            date_patterns=date_patterns,
            rooms=rooms,
            instructors=instructors,
            courses=courses,
            sections=sections,
            constraint_weights=constraint_weights,
            constraint_options=constraint_options,
        )


async def _load_meeting_patterns(
    conn: asyncpg.Connection,
    institution_id: UUID,
) -> list[MeetingPattern]:
    """Load meeting patterns with their time slots."""
    rows = await conn.fetch(
        """
        SELECT
            mp.id, mp.name, mp.code, mp.total_minutes_per_week, mp.pattern_type,
            mpt.day_of_week, mpt.start_time, mpt.end_time, mpt.break_minutes
        FROM scheduling.meeting_patterns mp
        LEFT JOIN scheduling.meeting_pattern_times mpt ON mp.id = mpt.pattern_id
        WHERE mp.institution_id = $1 AND mp.is_visible = true
        ORDER BY mp.sort_order, mp.id, mpt.day_of_week, mpt.start_time
        """,
        institution_id,
    )

    # Group times by pattern
    patterns: dict[UUID, dict] = {}
    for row in rows:
        pid = row["id"]
        if pid not in patterns:
            patterns[pid] = {
                "id": pid,
                "name": row["name"],
                "code": row["code"],
                "total_minutes_per_week": row["total_minutes_per_week"],
                "pattern_type": row["pattern_type"],
                "times": [],
            }
        if row["day_of_week"] is not None:
            patterns[pid]["times"].append(
                MeetingTime(
                    day_of_week=row["day_of_week"],
                    start_time=row["start_time"],
                    end_time=row["end_time"],
                    break_minutes=row["break_minutes"] or 0,
                )
            )

    return [
        MeetingPattern(
            id=p["id"],
            name=p["name"],
            code=p["code"],
            times=tuple(p["times"]),
            total_minutes_per_week=p["total_minutes_per_week"],
            pattern_type=p["pattern_type"],
        )
        for p in patterns.values()
    ]


async def _load_date_patterns(
    conn: asyncpg.Connection,
    term_id: UUID,
) -> list[DatePattern]:
    """Load date patterns for the term."""
    rows = await conn.fetch(
        """
        SELECT id, name, first_date, last_date, pattern_type
        FROM scheduling.date_patterns
        WHERE term_id = $1
        ORDER BY is_default DESC, name
        """,
        term_id,
    )

    return [
        DatePattern(
            id=row["id"],
            name=row["name"],
            first_date=row["first_date"],
            last_date=row["last_date"],
            pattern_type=row["pattern_type"],
        )
        for row in rows
    ]


async def _load_rooms(
    conn: asyncpg.Connection,
    institution_id: UUID,
) -> list[Room]:
    """Load rooms with features (conjunctive matching)."""
    # Rooms are related to institutions via building -> campus -> institution
    rows = await conn.fetch(
        """
        SELECT
            r.id, b.code || '-' || r.room_number as code, r.name, r.capacity,
            r.building_id, r.is_schedulable,
            rf.feature_type_id, rft.code as feature_code, rft.name as feature_name,
            rf.quantity
        FROM core.rooms r
        JOIN core.buildings b ON r.building_id = b.id
        JOIN core.campuses c ON b.campus_id = c.id
        LEFT JOIN scheduling.room_features rf ON r.id = rf.room_id
        LEFT JOIN scheduling.room_feature_types rft ON rf.feature_type_id = rft.id
        WHERE c.institution_id = $1 AND r.is_schedulable = true
        ORDER BY r.id
        """,
        institution_id,
    )

    rooms: dict[UUID, dict] = {}
    for row in rows:
        rid = row["id"]
        if rid not in rooms:
            rooms[rid] = {
                "id": rid,
                "code": row["code"],
                "name": row["name"],
                "capacity": row["capacity"],
                "building_id": row["building_id"],
                "is_schedulable": row["is_schedulable"],
                "features": set(),
            }
        if row["feature_type_id"]:
            rooms[rid]["features"].add(
                RoomFeature(
                    id=row["feature_type_id"],
                    code=row["feature_code"],
                    name=row["feature_name"],
                    quantity=row["quantity"] or 1,
                )
            )

    return [
        Room(
            id=r["id"],
            code=r["code"],
            name=r["name"],
            capacity=r["capacity"],
            building_id=r["building_id"],
            features=frozenset(r["features"]),
            is_schedulable=r["is_schedulable"],
        )
        for r in rooms.values()
    ]


async def _load_instructors(
    conn: asyncpg.Connection,
    institution_id: UUID,
    term_id: UUID,
) -> list[Instructor]:
    """Load instructors with preferences and workload limits."""
    # Main instructor data with workload
    # Instructors are users in identity.users who have workload records or are assigned to sections
    rows = await conn.fetch(
        """
        SELECT DISTINCT
            u.id,
            COALESCE(u.display_name, u.first_name || ' ' || u.last_name) as name,
            iw.min_load, iw.max_load, iw.target_load,
            iw.max_courses, iw.max_preps
        FROM identity.users u
        LEFT JOIN scheduling.instructor_workloads iw
            ON u.id = iw.instructor_id AND iw.term_id = $2
        WHERE u.institution_id = $1
          AND u.status = 'active'
          AND (iw.id IS NOT NULL
               OR EXISTS (
                   SELECT 1 FROM curriculum.section_instructors si
                   JOIN curriculum.sections s ON si.section_id = s.id
                   WHERE si.instructor_id = u.id AND s.term_id = $2
               ))
        """,
        institution_id,
        term_id,
    )

    # Time preferences (correct table name)
    pref_rows = await conn.fetch(
        """
        SELECT
            instructor_id, day_of_week, start_time, end_time,
            meeting_pattern_id, preference_level
        FROM scheduling.instructor_time_preferences
        WHERE term_id = $1
        """,
        term_id,
    )

    # Qualifications (join via users table for institution filtering)
    qual_rows = await conn.fetch(
        """
        SELECT iq.instructor_id, iq.course_id
        FROM scheduling.instructor_qualifications iq
        JOIN identity.users u ON iq.instructor_id = u.id
        WHERE u.institution_id = $1
          AND (iq.effective_to IS NULL OR iq.effective_to > CURRENT_DATE)
        """,
        institution_id,
    )

    # Build lookup maps
    prefs_by_instructor: dict[UUID, list[InstructorPreference]] = {}
    for row in pref_rows:
        iid = row["instructor_id"]
        if iid not in prefs_by_instructor:
            prefs_by_instructor[iid] = []
        prefs_by_instructor[iid].append(
            InstructorPreference(
                day_of_week=row["day_of_week"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                meeting_pattern_id=row["meeting_pattern_id"],
                preference_level=PreferenceLevel(row["preference_level"]),
            )
        )

    quals_by_instructor: dict[UUID, set[UUID]] = {}
    for row in qual_rows:
        iid = row["instructor_id"]
        if iid not in quals_by_instructor:
            quals_by_instructor[iid] = set()
        quals_by_instructor[iid].add(row["course_id"])

    return [
        Instructor(
            id=row["id"],
            name=row["name"],
            min_load=float(row["min_load"] or 0),
            max_load=float(row["max_load"] or 12),
            target_load=float(row["target_load"]) if row["target_load"] else None,
            max_courses=row["max_courses"],
            max_preps=row["max_preps"],
            time_preferences=tuple(prefs_by_instructor.get(row["id"], [])),
            qualified_course_ids=frozenset(quals_by_instructor.get(row["id"], set())),
        )
        for row in rows
    ]


async def _load_courses(
    conn: asyncpg.Connection,
    institution_id: UUID,
) -> list[Course]:
    """Load courses with required room features."""
    rows = await conn.fetch(
        """
        SELECT
            c.id,
            COALESCE(c.course_code, s.code || ' ' || c.course_number) as code,
            c.title as name,
            c.credit_hours_min as credit_hours,
            crr.feature_type_id
        FROM curriculum.courses c
        JOIN curriculum.subjects s ON c.subject_id = s.id
        LEFT JOIN scheduling.course_room_requirements crr
            ON c.id = crr.course_id AND crr.is_required = true
        WHERE c.institution_id = $1 AND c.is_active = true
        ORDER BY c.id
        """,
        institution_id,
    )

    courses: dict[UUID, dict] = {}
    for row in rows:
        cid = row["id"]
        if cid not in courses:
            courses[cid] = {
                "id": cid,
                "code": row["code"],
                "name": row["name"],
                "credit_hours": float(row["credit_hours"]),
                "required_room_features": set(),
            }
        if row["feature_type_id"]:
            courses[cid]["required_room_features"].add(row["feature_type_id"])

    return [
        Course(
            id=c["id"],
            code=c["code"],
            name=c["name"],
            credit_hours=c["credit_hours"],
            required_room_features=frozenset(c["required_room_features"]),
        )
        for c in courses.values()
    ]


async def _load_sections(
    conn: asyncpg.Connection,
    term_id: UUID,
    schedule_version_id: UUID,
) -> list[Section]:
    """Load sections with constraints and instructor assignments."""
    # Sections are in curriculum.sections (not scheduling.sections)
    # Cross-list and link groups are in scheduling schema
    rows = await conn.fetch(
        """
        SELECT
            s.id, s.course_id, s.section_number,
            s.max_enrollment as expected_enrollment,
            s.credit_hours,
            clg.id as cross_list_group_id,
            slg.id as link_group_id,
            CASE WHEN sl.link_role = 'parent' THEN true ELSE false END as is_link_parent,
            sa.meeting_pattern_id as fixed_pattern,
            sa.room_id as fixed_room,
            sa.date_pattern_id as fixed_date_pattern
        FROM curriculum.sections s
        LEFT JOIN scheduling.cross_list_groups clg
            ON clg.control_section_id = s.id
        LEFT JOIN scheduling.section_links sl ON sl.section_id = s.id
        LEFT JOIN scheduling.section_link_groups slg ON sl.link_group_id = slg.id
        LEFT JOIN scheduling.section_assignments sa
            ON s.id = sa.section_id
            AND sa.schedule_version_id = $2
            AND sa.valid_to IS NULL
            AND sa.is_manual_override = true
        WHERE s.term_id = $1 AND s.status = 'active'
        """,
        term_id,
        schedule_version_id,
    )

    # Pre-assigned instructors (from curriculum.section_instructors)
    instructor_rows = await conn.fetch(
        """
        SELECT si.section_id, si.instructor_id
        FROM curriculum.section_instructors si
        JOIN curriculum.sections s ON si.section_id = s.id
        WHERE s.term_id = $1
        """,
        term_id,
    )

    instructors_by_section: dict[UUID, list[UUID]] = {}
    for row in instructor_rows:
        sid = row["section_id"]
        if sid not in instructors_by_section:
            instructors_by_section[sid] = []
        instructors_by_section[sid].append(row["instructor_id"])

    return [
        Section(
            id=row["id"],
            course_id=row["course_id"],
            section_number=row["section_number"],
            expected_enrollment=row["expected_enrollment"],
            credit_hours=float(row["credit_hours"]),
            cross_list_group_id=row["cross_list_group_id"],
            link_group_id=row["link_group_id"],
            is_link_parent=row["is_link_parent"] or False,
            fixed_meeting_pattern_id=row["fixed_pattern"],
            fixed_room_id=row["fixed_room"],
            fixed_date_pattern_id=row["fixed_date_pattern"],
            assigned_instructor_ids=tuple(
                instructors_by_section.get(row["id"], [])
            ),
        )
        for row in rows
    ]


async def _load_constraint_weights(
    conn: asyncpg.Connection,
    institution_id: UUID,
) -> dict[str, float]:
    """Load institution-specific constraint weights."""
    rows = await conn.fetch(
        """
        SELECT code, default_weight
        FROM scheduling.constraint_types
        WHERE institution_id = $1 AND is_enabled = true AND default_weight IS NOT NULL
        """,
        institution_id,
    )

    return {row["code"]: float(row["default_weight"]) for row in rows}


async def _load_constraint_options(
    conn: asyncpg.Connection,
    institution_id: UUID,
) -> dict[str, str]:
    """Load non-numeric constraint configuration options."""
    rows = await conn.fetch(
        """
        SELECT code, parameters
        FROM scheduling.constraint_types
        WHERE institution_id = $1 AND is_enabled = true AND parameters IS NOT NULL
        """,
        institution_id,
    )

    # Extract string options from JSONB parameters
    options: dict[str, str] = {}
    for row in rows:
        params = row["parameters"]
        if isinstance(params, dict):
            for key, value in params.items():
                if isinstance(value, str):
                    options[f"{row['code']}_{key}"] = value

    return options


# =============================================================================
# Data Saver Functions
# =============================================================================


async def save_solver_output(
    schedule_version_id: UUID,
    output: SolverOutput,
) -> None:
    """Persist solver output atomically (all-or-nothing).

    Following UniTime's pattern, the entire solution is saved in a single
    transaction to prevent partial/corrupt schedules. If any step fails,
    the entire operation rolls back.

    Args:
        schedule_version_id: The schedule version being updated
        output: Complete solver output with assignments and violations
    """
    logger.info(
        "Saving solver output to database",
        solver_run_id=str(output.solver_run_id),
        schedule_version_id=str(schedule_version_id),
        status=output.result.status,
        assignments=len(output.assignments),
    )

    async with get_connection() as conn:
        async with conn.transaction():
            # 1. Insert/update solver run record
            # Pack solver stats into JSONB
            import json
            solver_stats = json.dumps({
                "solve_time_ms": output.result.solve_time_ms,
                "branches": output.result.branches,
                "conflicts": output.result.conflicts,
            })

            assigned_count = sum(1 for a in output.assignments if a.is_assigned)
            unassigned_count = len(output.assignments) - assigned_count

            await conn.execute(
                """
                INSERT INTO scheduling.solver_runs
                    (id, schedule_version_id, status, started_at, completed_at,
                     input_sections, assigned_sections, unassigned_sections,
                     total_penalty, solver_stats)
                VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6, $7, $8::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    completed_at = NOW(),
                    input_sections = EXCLUDED.input_sections,
                    assigned_sections = EXCLUDED.assigned_sections,
                    unassigned_sections = EXCLUDED.unassigned_sections,
                    total_penalty = EXCLUDED.total_penalty,
                    solver_stats = EXCLUDED.solver_stats
                """,
                output.solver_run_id,
                schedule_version_id,
                output.result.status,
                len(output.assignments),  # input_sections
                assigned_count,            # assigned_sections
                unassigned_count,          # unassigned_sections
                output.result.objective_value,  # total_penalty
                solver_stats,              # solver_stats as JSONB
            )

            # 2. Expire previous solver-generated assignments for this version
            # (use temporal pattern: set valid_to instead of DELETE)
            expired = await conn.execute(
                """
                UPDATE scheduling.section_assignments
                SET valid_to = NOW()
                WHERE schedule_version_id = $1
                  AND valid_to IS NULL
                  AND assignment_source = 'solver'
                """,
                schedule_version_id,
            )
            logger.debug("Expired previous assignments", expired=expired)

            # 3. Bulk insert new assignments (only assigned sections)
            assigned = [a for a in output.assignments if a.is_assigned]
            if assigned:
                await conn.executemany(
                    """
                    INSERT INTO scheduling.section_assignments
                        (section_id, schedule_version_id, meeting_pattern_id,
                         date_pattern_id, room_id, penalty_contribution,
                         assignment_source, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, 'solver', $7)
                    """,
                    [
                        (
                            a.section_id,
                            schedule_version_id,
                            a.meeting_pattern_id,
                            a.date_pattern_id,
                            a.room_id,
                            a.penalty_contribution,
                            a.unassigned_reason,  # Store any notes here
                        )
                        for a in assigned
                    ],
                )
                logger.debug(
                    "Inserted section assignments", count=len(assigned)
                )

            # 4. Save instructor assignments
            # instructor_assignments table uses section_assignment_id FK
            # We need to query for the newly created section_assignments
            if assigned:
                # Get newly inserted section assignment IDs
                section_assignment_rows = await conn.fetch(
                    """
                    SELECT id, section_id
                    FROM scheduling.section_assignments
                    WHERE schedule_version_id = $1
                      AND valid_to IS NULL
                      AND assignment_source = 'solver'
                    """,
                    schedule_version_id,
                )
                section_assignment_map = {
                    row["section_id"]: row["id"] for row in section_assignment_rows
                }

                instructor_assignments_data = []
                for a in assigned:
                    sa_id = section_assignment_map.get(a.section_id)
                    if sa_id:
                        for iid in a.instructor_ids:
                            instructor_assignments_data.append((sa_id, iid))

                if instructor_assignments_data:
                    await conn.executemany(
                        """
                        INSERT INTO scheduling.instructor_assignments
                            (section_assignment_id, instructor_id, role)
                        VALUES ($1, $2, 'primary')
                        ON CONFLICT DO NOTHING
                        """,
                        instructor_assignments_data,
                    )
                    logger.debug(
                        "Inserted instructor assignments",
                        count=len(instructor_assignments_data),
                    )

            # 5. Save violations for reporting
            # constraint_violations requires constraint_type_id FK
            if output.violations:
                await conn.executemany(
                    """
                    INSERT INTO scheduling.constraint_violations
                        (solver_run_id, constraint_type_id, section_id,
                         instructor_id, room_id, penalty_value, description)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    [
                        (
                            output.solver_run_id,
                            v.get("constraint_type_id"),  # FK to constraint_types
                            v.get("section_id"),
                            v.get("instructor_id"),
                            v.get("room_id"),
                            v.get("penalty", 0),
                            v.get("description"),
                        )
                        for v in output.violations
                    ],
                )
                logger.debug("Inserted violations", count=len(output.violations))

    logger.info(
        "Solver output saved successfully",
        solver_run_id=str(output.solver_run_id),
        assigned=sum(1 for a in output.assignments if a.is_assigned),
        unassigned=sum(1 for a in output.assignments if not a.is_assigned),
    )


async def commit_schedule_version(schedule_version_id: UUID) -> int:
    """Publish a schedule version (change status from 'draft' to 'published').

    This is called after the user approves a generated schedule.
    It updates the schedule_versions.status and sets published_at timestamp.

    Args:
        schedule_version_id: The schedule version to publish

    Returns:
        Number of current assignments in the version
    """
    async with get_connection() as conn:
        # Update schedule version status to 'published'
        await conn.execute(
            """
            UPDATE scheduling.schedule_versions
            SET status = 'published',
                published_at = NOW(),
                updated_at = NOW()
            WHERE id = $1 AND status = 'draft'
            """,
            schedule_version_id,
        )

        # Count assignments for this version
        count_row = await conn.fetchrow(
            """
            SELECT COUNT(*) as cnt
            FROM scheduling.section_assignments
            WHERE schedule_version_id = $1 AND valid_to IS NULL
            """,
            schedule_version_id,
        )
        count = count_row["cnt"] if count_row else 0

        logger.info(
            "Schedule version published",
            schedule_version_id=str(schedule_version_id),
            assignments_count=count,
        )

        return count


async def get_solver_run_status(solver_run_id: UUID) -> dict | None:
    """Get status of a solver run.

    Args:
        solver_run_id: The solver run to check

    Returns:
        Dict with status info, or None if not found
    """
    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                id, schedule_version_id, status, solve_time_ms,
                objective_value, branches, conflicts, created_at
            FROM scheduling.solver_runs
            WHERE id = $1
            """,
            solver_run_id,
        )

        if not row:
            return None

        return {
            "solver_run_id": row["id"],
            "schedule_version_id": row["schedule_version_id"],
            "status": row["status"],
            "solve_time_ms": row["solve_time_ms"],
            "objective_value": float(row["objective_value"])
            if row["objective_value"]
            else None,
            "branches": row["branches"],
            "conflicts": row["conflicts"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        }
