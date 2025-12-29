import {
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  decimal,
  date,
  time,
  smallint,
  jsonb,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { institutions, terms, rooms, buildings } from "./core.js";
import { users } from "./identity.js";
import { courses, sections, departments } from "./curriculum.js";

/**
 * Scheduling Schema
 *
 * Provides course scheduling optimization support including:
 * - Meeting patterns (reusable time blocks)
 * - Instructor availability and workload management
 * - Room availability and feature matching
 * - Section relationships (cross-listing, linked sections)
 * - Schedule versioning (draft → published → archived)
 * - Solver run tracking and constraint violations
 *
 * Based on research from:
 * - UniTime (https://github.com/UniTime/unitime)
 * - Banner SIS scheduling module
 * - PeopleSoft Campus Solutions
 *
 * Design principles:
 * - Temporal data with effective dating
 * - Schedule versioning (not per-run records)
 * - Normalized meeting patterns
 * - Configurable constraints (database-driven weights)
 * - Multi-instructor support with load distribution
 * - OLTP-optimized indexes (analytics handled by DuckDB sync)
 */
export const schedulingSchema = pgSchema("scheduling");

// =============================================================================
// REFERENCE / LOOKUP TABLES
// =============================================================================

/**
 * Preference Levels (from UniTime model)
 * Standard 5-level scale for instructor/room preferences
 */
export const preferenceLevels = schedulingSchema.table("preference_levels", {
  id: integer("id").primaryKey(), // -2 to 2
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }), // Hex color for UI
  penaltyMultiplier: decimal("penalty_multiplier", { precision: 5, scale: 2 }),
});

/**
 * Constraint Types (configurable per institution)
 * Defines hard and soft constraints with weights
 */
export const constraintTypes = schedulingSchema.table(
  "constraint_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    constraintClass: varchar("constraint_class", { length: 20 }).notNull(), // "hard", "soft", "distribution"
    defaultWeight: integer("default_weight"), // For soft constraints
    isEnabled: boolean("is_enabled").default(true),
    parameters: jsonb("parameters").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueCode: unique().on(table.institutionId, table.code),
  })
);

/**
 * Instructor Attribute Types
 * Qualifications, certifications, skills that can be assigned to instructors
 */
export const instructorAttributeTypes = schedulingSchema.table(
  "instructor_attribute_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isConjunctive: boolean("is_conjunctive").default(false), // All vs Any matching
    isRequired: boolean("is_required").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueCode: unique().on(table.institutionId, table.code),
  })
);

// =============================================================================
// TIME PATTERN TABLES
// =============================================================================

/**
 * Meeting Patterns
 * Reusable time block templates (e.g., "Standard MWF 50-min", "TR 75-min")
 */
export const meetingPatterns = schedulingSchema.table("meeting_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }),
  totalMinutesPerWeek: integer("total_minutes_per_week").notNull(),
  creditHoursMin: decimal("credit_hours_min", { precision: 3, scale: 1 }),
  creditHoursMax: decimal("credit_hours_max", { precision: 3, scale: 1 }),
  patternType: varchar("pattern_type", { length: 20 }), // "standard", "evening", "weekend", "compressed"
  isVisible: boolean("is_visible").default(true),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Meeting Pattern Times
 * Individual day/time slots within a pattern
 */
export const meetingPatternTimes = schedulingSchema.table(
  "meeting_pattern_times",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => meetingPatterns.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    breakMinutes: integer("break_minutes").default(0), // Built-in break time
  }
);

/**
 * Date Patterns
 * Academic calendar exclusions (holidays, breaks, partial terms)
 */
export const datePatterns = schedulingSchema.table("date_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  name: varchar("name", { length: 100 }).notNull(),
  patternBits: varchar("pattern_bits", { length: 500 }), // Bitmap of included dates
  firstDate: date("first_date").notNull(),
  lastDate: date("last_date").notNull(),
  patternType: varchar("pattern_type", { length: 20 }), // "full_term", "first_half", "second_half"
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// =============================================================================
// ROOM & SPACE TABLES
// =============================================================================

/**
 * Room Availability
 * Blackout periods, departmental ownership, renovation windows
 */
export const roomAvailability = schedulingSchema.table("room_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  termId: uuid("term_id").references(() => terms.id), // NULL = all terms
  dayOfWeek: smallint("day_of_week"), // NULL = all days
  startTime: time("start_time"),
  endTime: time("end_time"),
  availabilityType: varchar("availability_type", { length: 20 }).notNull(), // "available", "blocked", "dept_priority"
  departmentId: uuid("department_id").references(() => departments.id),
  reason: text("reason"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Room Feature Types
 * Institution-level feature definitions
 */
export const roomFeatureTypes = schedulingSchema.table(
  "room_feature_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id),
    code: varchar("code", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    featureGroup: varchar("feature_group", { length: 50 }), // "technology", "furniture", "accessibility"
    isQuantifiable: boolean("is_quantifiable").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueCode: unique().on(table.institutionId, table.code),
  })
);

/**
 * Room Features
 * Which rooms have what features
 */
export const roomFeatures = schedulingSchema.table(
  "room_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    featureTypeId: uuid("feature_type_id")
      .notNull()
      .references(() => roomFeatureTypes.id),
    quantity: integer("quantity").default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueRoomFeature: unique().on(table.roomId, table.featureTypeId),
  })
);

/**
 * Room Preferences
 * Preferences for rooms/buildings by sections, instructors, or departments
 */
export const roomPreferences = schedulingSchema.table("room_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(), // Section, instructor, or department ID
  ownerType: varchar("owner_type", { length: 20 }).notNull(), // "section", "instructor", "department"
  roomId: uuid("room_id").references(() => rooms.id),
  buildingId: uuid("building_id").references(() => buildings.id),
  featureTypeId: uuid("feature_type_id").references(() => roomFeatureTypes.id),
  preferenceLevel: integer("preference_level").notNull().default(0), // -2 to 2
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// =============================================================================
// INSTRUCTOR TABLES
// =============================================================================

/**
 * Instructor Workloads
 * Teaching limits per term
 */
export const instructorWorkloads = schedulingSchema.table(
  "instructor_workloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    employmentType: varchar("employment_type", { length: 20 }), // "tenured", "tenure_track", "ntt", "adjunct", "visiting"
    minLoad: decimal("min_load", { precision: 5, scale: 2 }).default("0"),
    maxLoad: decimal("max_load", { precision: 5, scale: 2 }).notNull(),
    targetLoad: decimal("target_load", { precision: 5, scale: 2 }),
    maxCourses: integer("max_courses"),
    maxPreps: integer("max_preps"), // Distinct course preparations
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueInstructorTerm: unique().on(table.instructorId, table.termId),
  })
);

/**
 * Instructor Attributes
 * Certifications, qualifications assigned to instructors
 */
export const instructorAttributes = schedulingSchema.table(
  "instructor_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    attributeTypeId: uuid("attribute_type_id")
      .notNull()
      .references(() => instructorAttributeTypes.id),
    value: varchar("value", { length: 100 }), // For typed attributes
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

/**
 * Instructor Qualifications
 * Which courses an instructor is qualified to teach
 */
export const instructorQualifications = schedulingSchema.table(
  "instructor_qualifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    qualificationLevel: varchar("qualification_level", { length: 20 }).notNull(), // "primary", "secondary", "emergency_only"
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    instructorCourseIdx: index("instructor_qualifications_instructor_course_idx").on(
      table.instructorId,
      table.courseId
    ),
  })
);

/**
 * Instructor Time Preferences
 * When instructors prefer (or cannot) teach
 */
export const instructorTimePreferences = schedulingSchema.table(
  "instructor_time_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    dayOfWeek: smallint("day_of_week"), // NULL = all days
    startTime: time("start_time"),
    endTime: time("end_time"),
    meetingPatternId: uuid("meeting_pattern_id").references(
      () => meetingPatterns.id
    ),
    preferenceLevel: integer("preference_level").notNull().default(0), // -2 to 2
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    instructorTermIdx: index("instructor_time_preferences_instructor_term_idx").on(
      table.instructorId,
      table.termId
    ),
  })
);

// =============================================================================
// SECTION RELATIONSHIP TABLES
// =============================================================================

/**
 * Cross-List Groups
 * Groups of sections that meet at the same time/room with different course codes
 * Note: Works with existing curriculum.crossListedSections table
 */
export const crossListGroups = schedulingSchema.table("cross_list_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  name: varchar("name", { length: 100 }),
  controlSectionId: uuid("control_section_id").references(() => sections.id), // Primary section for scheduling
  totalCapacity: integer("total_capacity"), // Combined enrollment cap
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Section Link Groups
 * Groups of linked sections (lecture + required lab)
 */
export const sectionLinkGroups = schedulingSchema.table("section_link_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  linkType: varchar("link_type", { length: 20 }).notNull(), // "required", "recommended", "coreq"
  name: varchar("name", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Section Links
 * Membership in section link groups
 */
export const sectionLinks = schedulingSchema.table(
  "section_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkGroupId: uuid("link_group_id")
      .notNull()
      .references(() => sectionLinkGroups.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id),
    linkRole: varchar("link_role", { length: 20 }).notNull(), // "parent", "child"
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueSectionLink: unique().on(table.linkGroupId, table.sectionId),
  })
);

/**
 * Course Room Requirements
 * What room features a course requires
 */
export const courseRoomRequirements = schedulingSchema.table(
  "course_room_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    featureTypeId: uuid("feature_type_id")
      .notNull()
      .references(() => roomFeatureTypes.id),
    minimumQuantity: integer("minimum_quantity").default(1),
    isRequired: boolean("is_required").default(true), // Required vs preferred
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueCourseFeature: unique().on(table.courseId, table.featureTypeId),
  })
);

// =============================================================================
// SCHEDULE VERSIONING
// =============================================================================

/**
 * Schedule Versions
 * Draft → Published → Archived workflow for schedules
 */
export const scheduleVersions = schedulingSchema.table(
  "schedule_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id),
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    versionNumber: integer("version_number").notNull(),
    name: varchar("name", { length: 100 }),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // "draft", "published", "archived"
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueTermVersion: unique().on(table.termId, table.versionNumber),
    publishedIdx: index("schedule_versions_published_idx")
      .on(table.termId, table.status)
      .where(sql`status = 'published'`),
  })
);

/**
 * Solver Runs
 * Optimization attempts within a schedule version
 */
export const solverRuns = schedulingSchema.table("solver_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scheduleVersionId: uuid("schedule_version_id")
    .notNull()
    .references(() => scheduleVersions.id),
  status: varchar("status", { length: 20 }).notNull(), // "pending", "running", "completed", "failed", "cancelled"
  runType: varchar("run_type", { length: 20 }), // "full", "incremental", "feasibility_check"
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  inputSections: integer("input_sections"),
  assignedSections: integer("assigned_sections"),
  unassignedSections: integer("unassigned_sections"),
  totalPenalty: decimal("total_penalty", { precision: 12, scale: 2 }),
  solverConfig: jsonb("solver_config").$type<Record<string, unknown>>(), // Solver parameters used
  solverStats: jsonb("solver_stats").$type<SolverStats>(), // Time, iterations, etc.
  errorMessage: text("error_message"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export interface SolverStats {
  solveTimeMs: number;
  iterations: number;
  objectiveValue: number;
  status: string;
  branches: number;
  conflicts: number;
}

/**
 * Constraint Violations
 * Detailed violations from a solver run
 */
export const constraintViolations = schedulingSchema.table(
  "constraint_violations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solverRunId: uuid("solver_run_id")
      .notNull()
      .references(() => solverRuns.id, { onDelete: "cascade" }),
    constraintTypeId: uuid("constraint_type_id")
      .notNull()
      .references(() => constraintTypes.id),
    sectionId: uuid("section_id").references(() => sections.id),
    instructorId: uuid("instructor_id").references(() => users.id),
    roomId: uuid("room_id").references(() => rooms.id),
    penaltyValue: decimal("penalty_value", { precision: 10, scale: 2 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

// =============================================================================
// ASSIGNMENT TABLES
// =============================================================================

/**
 * Section Assignments
 * Scheduled time/room assignments for sections (with temporal support)
 */
export const sectionAssignments = schedulingSchema.table(
  "section_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleVersionId: uuid("schedule_version_id")
      .notNull()
      .references(() => scheduleVersions.id),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id),
    meetingPatternId: uuid("meeting_pattern_id").references(
      () => meetingPatterns.id
    ),
    datePatternId: uuid("date_pattern_id").references(() => datePatterns.id),
    roomId: uuid("room_id").references(() => rooms.id),
    isManualOverride: boolean("is_manual_override").default(false),
    penaltyContribution: decimal("penalty_contribution", {
      precision: 10,
      scale: 2,
    }).default("0"),
    assignmentSource: varchar("assignment_source", { length: 20 }), // "solver", "manual", "rollforward"
    notes: text("notes"),

    // Temporal tracking
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current
    changedBy: uuid("changed_by").references(() => users.id),
    changeReason: varchar("change_reason", { length: 100 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    versionSectionIdx: index("section_assignments_version_section_idx").on(
      table.scheduleVersionId,
      table.sectionId
    ),
    currentAssignmentsIdx: index("section_assignments_current_idx")
      .on(table.sectionId)
      .where(sql`valid_to IS NULL`),
  })
);

/**
 * Instructor Assignments
 * Which instructors are assigned to which section assignments (supports team teaching)
 */
export const instructorAssignments = schedulingSchema.table(
  "instructor_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionAssignmentId: uuid("section_assignment_id")
      .notNull()
      .references(() => sectionAssignments.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 20 }).notNull().default("primary"), // "primary", "secondary", "assistant", "ta"
    loadCredit: decimal("load_credit", { precision: 5, scale: 2 }), // Teaching load units
    percentResponsibility: integer("percent_responsibility").default(100),
    schedulingWeight: decimal("scheduling_weight", {
      precision: 3,
      scale: 2,
    }).default("1.0"), // Conflict weight (0 = ignore for scheduling)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueAssignment: unique().on(
      table.sectionAssignmentId,
      table.instructorId
    ),
  })
);

// =============================================================================
// EXAM SCHEDULING
// =============================================================================

/**
 * Exam Periods
 * Midterm and final exam windows
 */
export const examPeriods = schedulingSchema.table("exam_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  examType: varchar("exam_type", { length: 20 }).notNull(), // "midterm", "final"
  name: varchar("name", { length: 100 }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  defaultStartTime: time("default_start_time"),
  defaultDurationMinutes: integer("default_duration_minutes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Exam Assignments
 * Scheduled exam times and rooms
 */
export const examAssignments = schedulingSchema.table("exam_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  examPeriodId: uuid("exam_period_id")
    .notNull()
    .references(() => examPeriods.id),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id),
  roomId: uuid("room_id").references(() => rooms.id),
  examDate: date("exam_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isManualOverride: boolean("is_manual_override").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const constraintTypesRelations = relations(constraintTypes, ({ one }) => ({
  institution: one(institutions, {
    fields: [constraintTypes.institutionId],
    references: [institutions.id],
  }),
}));

export const instructorAttributeTypesRelations = relations(
  instructorAttributeTypes,
  ({ one }) => ({
    institution: one(institutions, {
      fields: [instructorAttributeTypes.institutionId],
      references: [institutions.id],
    }),
  })
);

export const meetingPatternsRelations = relations(
  meetingPatterns,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [meetingPatterns.institutionId],
      references: [institutions.id],
    }),
    times: many(meetingPatternTimes),
  })
);

export const meetingPatternTimesRelations = relations(
  meetingPatternTimes,
  ({ one }) => ({
    pattern: one(meetingPatterns, {
      fields: [meetingPatternTimes.patternId],
      references: [meetingPatterns.id],
    }),
  })
);

export const datePatternsRelations = relations(datePatterns, ({ one }) => ({
  term: one(terms, {
    fields: [datePatterns.termId],
    references: [terms.id],
  }),
}));

export const roomAvailabilityRelations = relations(
  roomAvailability,
  ({ one }) => ({
    room: one(rooms, {
      fields: [roomAvailability.roomId],
      references: [rooms.id],
    }),
    term: one(terms, {
      fields: [roomAvailability.termId],
      references: [terms.id],
    }),
    department: one(departments, {
      fields: [roomAvailability.departmentId],
      references: [departments.id],
    }),
  })
);

export const roomFeatureTypesRelations = relations(
  roomFeatureTypes,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [roomFeatureTypes.institutionId],
      references: [institutions.id],
    }),
    features: many(roomFeatures),
  })
);

export const roomFeaturesRelations = relations(roomFeatures, ({ one }) => ({
  room: one(rooms, {
    fields: [roomFeatures.roomId],
    references: [rooms.id],
  }),
  featureType: one(roomFeatureTypes, {
    fields: [roomFeatures.featureTypeId],
    references: [roomFeatureTypes.id],
  }),
}));

export const instructorWorkloadsRelations = relations(
  instructorWorkloads,
  ({ one }) => ({
    instructor: one(users, {
      fields: [instructorWorkloads.instructorId],
      references: [users.id],
    }),
    term: one(terms, {
      fields: [instructorWorkloads.termId],
      references: [terms.id],
    }),
  })
);

export const instructorAttributesRelations = relations(
  instructorAttributes,
  ({ one }) => ({
    instructor: one(users, {
      fields: [instructorAttributes.instructorId],
      references: [users.id],
    }),
    attributeType: one(instructorAttributeTypes, {
      fields: [instructorAttributes.attributeTypeId],
      references: [instructorAttributeTypes.id],
    }),
  })
);

export const instructorQualificationsRelations = relations(
  instructorQualifications,
  ({ one }) => ({
    instructor: one(users, {
      fields: [instructorQualifications.instructorId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [instructorQualifications.courseId],
      references: [courses.id],
    }),
    approver: one(users, {
      fields: [instructorQualifications.approvedBy],
      references: [users.id],
    }),
  })
);

export const instructorTimePreferencesRelations = relations(
  instructorTimePreferences,
  ({ one }) => ({
    instructor: one(users, {
      fields: [instructorTimePreferences.instructorId],
      references: [users.id],
    }),
    term: one(terms, {
      fields: [instructorTimePreferences.termId],
      references: [terms.id],
    }),
    meetingPattern: one(meetingPatterns, {
      fields: [instructorTimePreferences.meetingPatternId],
      references: [meetingPatterns.id],
    }),
  })
);

export const crossListGroupsRelations = relations(
  crossListGroups,
  ({ one }) => ({
    term: one(terms, {
      fields: [crossListGroups.termId],
      references: [terms.id],
    }),
    controlSection: one(sections, {
      fields: [crossListGroups.controlSectionId],
      references: [sections.id],
    }),
  })
);

export const sectionLinkGroupsRelations = relations(
  sectionLinkGroups,
  ({ one, many }) => ({
    term: one(terms, {
      fields: [sectionLinkGroups.termId],
      references: [terms.id],
    }),
    links: many(sectionLinks),
  })
);

export const sectionLinksRelations = relations(sectionLinks, ({ one }) => ({
  linkGroup: one(sectionLinkGroups, {
    fields: [sectionLinks.linkGroupId],
    references: [sectionLinkGroups.id],
  }),
  section: one(sections, {
    fields: [sectionLinks.sectionId],
    references: [sections.id],
  }),
}));

export const courseRoomRequirementsRelations = relations(
  courseRoomRequirements,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseRoomRequirements.courseId],
      references: [courses.id],
    }),
    featureType: one(roomFeatureTypes, {
      fields: [courseRoomRequirements.featureTypeId],
      references: [roomFeatureTypes.id],
    }),
  })
);

export const scheduleVersionsRelations = relations(
  scheduleVersions,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [scheduleVersions.institutionId],
      references: [institutions.id],
    }),
    term: one(terms, {
      fields: [scheduleVersions.termId],
      references: [terms.id],
    }),
    publisher: one(users, {
      fields: [scheduleVersions.publishedBy],
      references: [users.id],
    }),
    creator: one(users, {
      fields: [scheduleVersions.createdBy],
      references: [users.id],
    }),
    solverRuns: many(solverRuns),
    assignments: many(sectionAssignments),
  })
);

export const solverRunsRelations = relations(solverRuns, ({ one, many }) => ({
  scheduleVersion: one(scheduleVersions, {
    fields: [solverRuns.scheduleVersionId],
    references: [scheduleVersions.id],
  }),
  creator: one(users, {
    fields: [solverRuns.createdBy],
    references: [users.id],
  }),
  violations: many(constraintViolations),
}));

export const constraintViolationsRelations = relations(
  constraintViolations,
  ({ one }) => ({
    solverRun: one(solverRuns, {
      fields: [constraintViolations.solverRunId],
      references: [solverRuns.id],
    }),
    constraintType: one(constraintTypes, {
      fields: [constraintViolations.constraintTypeId],
      references: [constraintTypes.id],
    }),
    section: one(sections, {
      fields: [constraintViolations.sectionId],
      references: [sections.id],
    }),
    instructor: one(users, {
      fields: [constraintViolations.instructorId],
      references: [users.id],
    }),
    room: one(rooms, {
      fields: [constraintViolations.roomId],
      references: [rooms.id],
    }),
  })
);

export const sectionAssignmentsRelations = relations(
  sectionAssignments,
  ({ one, many }) => ({
    scheduleVersion: one(scheduleVersions, {
      fields: [sectionAssignments.scheduleVersionId],
      references: [scheduleVersions.id],
    }),
    section: one(sections, {
      fields: [sectionAssignments.sectionId],
      references: [sections.id],
    }),
    meetingPattern: one(meetingPatterns, {
      fields: [sectionAssignments.meetingPatternId],
      references: [meetingPatterns.id],
    }),
    datePattern: one(datePatterns, {
      fields: [sectionAssignments.datePatternId],
      references: [datePatterns.id],
    }),
    room: one(rooms, {
      fields: [sectionAssignments.roomId],
      references: [rooms.id],
    }),
    changedByUser: one(users, {
      fields: [sectionAssignments.changedBy],
      references: [users.id],
    }),
    instructorAssignments: many(instructorAssignments),
  })
);

export const instructorAssignmentsRelations = relations(
  instructorAssignments,
  ({ one }) => ({
    sectionAssignment: one(sectionAssignments, {
      fields: [instructorAssignments.sectionAssignmentId],
      references: [sectionAssignments.id],
    }),
    instructor: one(users, {
      fields: [instructorAssignments.instructorId],
      references: [users.id],
    }),
  })
);

export const examPeriodsRelations = relations(examPeriods, ({ one, many }) => ({
  term: one(terms, {
    fields: [examPeriods.termId],
    references: [terms.id],
  }),
  assignments: many(examAssignments),
}));

export const examAssignmentsRelations = relations(
  examAssignments,
  ({ one }) => ({
    examPeriod: one(examPeriods, {
      fields: [examAssignments.examPeriodId],
      references: [examPeriods.id],
    }),
    section: one(sections, {
      fields: [examAssignments.sectionId],
      references: [sections.id],
    }),
    room: one(rooms, {
      fields: [examAssignments.roomId],
      references: [rooms.id],
    }),
  })
);
