import {
  pgTable,
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { institutions, terms, termSessions } from "./core.js";
import { users } from "./identity.js";
import { students, studentPrograms } from "./student.js";
import { sections, courses, grades } from "./curriculum.js";

// Enrollment schema for registration and grades
export const enrollmentSchema = pgSchema("enrollment");

// Registration - student enrollment in a section
export const registrations = enrollmentSchema.table("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  // Credit/billing hours for this registration (may vary for variable credit courses)
  creditHours: decimal("credit_hours", { precision: 4, scale: 2 }).notNull(),
  billingHours: decimal("billing_hours", { precision: 4, scale: 2 }),

  // Registration status
  status: varchar("status", { length: 20 }).default("registered").notNull(),
  // registered, waitlisted, dropped, withdrawn, completed

  // How registered
  registrationMethod: varchar("registration_method", { length: 20 }), // self, advisor, admin, batch

  // Grade mode
  gradeMode: varchar("grade_mode", { length: 20 }).default("standard"), // standard, pass_fail, audit

  // Grade information
  gradeId: uuid("grade_id").references(() => grades.id),
  gradeCode: varchar("grade_code", { length: 5 }), // Denormalized for easy access
  gradePoints: decimal("grade_points", { precision: 4, scale: 3 }),

  // Credits earned (after grading)
  creditsAttempted: decimal("credits_attempted", { precision: 4, scale: 2 }),
  creditsEarned: decimal("credits_earned", { precision: 4, scale: 2 }),
  qualityPoints: decimal("quality_points", { precision: 6, scale: 2 }),

  // Include in GPA calculation
  includeInGpa: boolean("include_in_gpa").default(true),

  // Midterm grade
  midtermGradeId: uuid("midterm_grade_id").references(() => grades.id),
  midtermGradeCode: varchar("midterm_grade_code", { length: 5 }),

  // Repeat information
  isRepeat: boolean("is_repeat").default(false),
  repeatOfRegistrationId: uuid("repeat_of_registration_id"), // References previous attempt
  repeatAction: varchar("repeat_action", { length: 20 }), // counted, excluded, replaced

  // Key dates
  registrationDate: timestamp("registration_date", { withTimezone: true }).defaultNow(),
  dropDate: timestamp("drop_date", { withTimezone: true }),
  withdrawalDate: timestamp("withdrawal_date", { withTimezone: true }),
  gradePostedDate: timestamp("grade_posted_date", { withTimezone: true }),

  // Last date of attendance (for R2T4 calculations)
  lastAttendanceDate: date("last_attendance_date"),

  // Override flags
  prerequisiteOverride: boolean("prerequisite_override").default(false),
  capacityOverride: boolean("capacity_override").default(false),
  restrictionOverride: boolean("restriction_override").default(false),
  overrideReason: text("override_reason"),
  overrideBy: uuid("override_by").references(() => users.id),

  // Special permissions
  instructorPermission: boolean("instructor_permission").default(false),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: student can only register once per section
  studentSectionIdx: uniqueIndex("registrations_student_section_idx").on(table.studentId, table.sectionId),
  studentTermIdx: index("registrations_student_term_idx").on(table.studentId, table.termId),
  sectionIdx: index("registrations_section_idx").on(table.sectionId),
  termStatusIdx: index("registrations_term_status_idx").on(table.termId, table.status),
  gradeIdx: index("registrations_grade_idx").on(table.gradeCode),
}));

// Waitlist entry
export const waitlistEntries = enrollmentSchema.table("waitlist_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id),

  position: integer("position").notNull(),

  // Notification sent when spot opened
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  notificationExpiresAt: timestamp("notification_expires_at", { withTimezone: true }),

  // Outcome
  status: varchar("status", { length: 20 }).default("waiting").notNull(), // waiting, notified, enrolled, expired, removed

  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sectionPositionIdx: index("waitlist_entries_section_position_idx").on(table.sectionId, table.position),
  studentIdx: index("waitlist_entries_student_idx").on(table.studentId),
}));

// Registration Hold preventing registration
export const registrationHolds = enrollmentSchema.table("registration_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  // FK to hold type configuration (preferred) - denormalized fields below for backwards compatibility
  holdTypeId: uuid("hold_type_id").references(() => holdTypes.id),

  // Legacy/denormalized fields - kept for backwards compatibility during migration
  holdType: varchar("hold_type", { length: 30 }).notNull(), // academic, financial, administrative, disciplinary
  holdCode: varchar("hold_code", { length: 20 }).notNull(),
  holdName: varchar("hold_name", { length: 100 }).notNull(),
  description: text("description"),

  // What is blocked
  blocksRegistration: boolean("blocks_registration").default(true),
  blocksGrades: boolean("blocks_grades").default(false),
  blocksTranscript: boolean("blocks_transcript").default(false),
  blocksDiploma: boolean("blocks_diploma").default(false),

  // Who can release
  releaseAuthority: varchar("release_authority", { length: 50 }),

  // Effective dates
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),

  // Resolution
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolutionNotes: text("resolution_notes"),

  // Who placed the hold
  placedBy: uuid("placed_by").references(() => users.id),
  placedByOffice: varchar("placed_by_office", { length: 100 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("registration_holds_student_idx").on(table.studentId),
  studentActiveIdx: index("registration_holds_student_active_idx").on(table.studentId, table.resolvedAt),
  holdTypeIdx: index("registration_holds_hold_type_idx").on(table.holdTypeId),
}));

// Term enrollment status/summary
export const termEnrollments = enrollmentSchema.table("term_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  studentProgramId: uuid("student_program_id")
    .references(() => studentPrograms.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  // Enrollment status
  enrollmentStatus: varchar("enrollment_status", { length: 20 }).default("enrolled").notNull(),
  // enrolled, not_enrolled, withdrawn, leave_of_absence, graduated

  // Enrollment type for reporting
  enrollmentType: varchar("enrollment_type", { length: 20 }), // full_time, half_time, less_than_half_time

  // Credit summary
  registeredCredits: decimal("registered_credits", { precision: 5, scale: 2 }).default("0"),
  attemptedCredits: decimal("attempted_credits", { precision: 5, scale: 2 }),
  earnedCredits: decimal("earned_credits", { precision: 5, scale: 2 }),
  qualityPoints: decimal("quality_points", { precision: 8, scale: 2 }),

  // Term GPA
  termGpa: decimal("term_gpa", { precision: 4, scale: 3 }),

  // Academic standing at end of term
  academicStanding: varchar("academic_standing", { length: 30 }),

  // Dean's list, honors, etc.
  honors: jsonb("honors").$type<string[]>(),

  // For determining full-time status
  // Minimum credits for full-time (typically 12 UG, 9 Grad)
  fullTimeCreditsRequired: decimal("full_time_credits_required", { precision: 4, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTermIdx: uniqueIndex("term_enrollments_student_term_idx").on(table.studentId, table.termId),
  termStatusIdx: index("term_enrollments_term_status_idx").on(table.termId, table.enrollmentStatus),
}));

// Transfer Credit
export const transferCredits = enrollmentSchema.table("transfer_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  // Source institution
  sourceInstitutionName: varchar("source_institution_name", { length: 200 }).notNull(),
  sourceInstitutionCode: varchar("source_institution_code", { length: 20 }), // FICE, CEEB
  sourceInstitutionType: varchar("source_institution_type", { length: 30 }), // 4year, 2year, international

  // Source course
  sourceCourseCode: varchar("source_course_code", { length: 30 }),
  sourceCourseTitle: varchar("source_course_title", { length: 200 }),
  sourceCredits: decimal("source_credits", { precision: 4, scale: 2 }).notNull(),
  sourceGrade: varchar("source_grade", { length: 10 }),

  // Transfer equivalency
  equivalentCourseId: uuid("equivalent_course_id").references(() => courses.id),
  transferCredits: decimal("transfer_credits", { precision: 4, scale: 2 }).notNull(),

  // Status
  status: varchar("status", { length: 20 }).default("approved").notNull(), // pending, approved, denied

  // Evaluation
  evaluatedBy: uuid("evaluated_by").references(() => users.id),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  evaluationNotes: text("evaluation_notes"),

  // Include in GPA (usually no for transfers)
  includeInGpa: boolean("include_in_gpa").default(false),

  // Transcript received date
  transcriptReceivedDate: date("transcript_received_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("transfer_credits_student_idx").on(table.studentId),
}));

// Test Score (for placement, admission, etc.)
export const testScores = enrollmentSchema.table("test_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  testCode: varchar("test_code", { length: 30 }).notNull(), // SAT, ACT, TOEFL, AP, etc.
  testName: varchar("test_name", { length: 100 }),
  testDate: date("test_date"),

  // Scores (can be composite or component)
  scoreType: varchar("score_type", { length: 30 }), // composite, math, verbal, writing, etc.
  score: decimal("score", { precision: 8, scale: 2 }).notNull(),
  maxScore: decimal("max_score", { precision: 8, scale: 2 }),
  percentile: integer("percentile"),

  // For AP/CLEP - credit awarded
  creditAwarded: decimal("credit_awarded", { precision: 4, scale: 2 }),
  equivalentCourseId: uuid("equivalent_course_id").references(() => courses.id),

  // Status
  status: varchar("status", { length: 20 }).default("official").notNull(), // official, self_reported, verified

  // Source
  sourceDocument: varchar("source_document", { length: 100 }),
  receivedDate: date("received_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTestIdx: index("test_scores_student_test_idx").on(table.studentId, table.testCode),
}));

// Registration Change Log (audit trail for add/drop/withdraw)
export const registrationChangeLogs = enrollmentSchema.table("registration_change_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id),

  changeType: varchar("change_type", { length: 30 }).notNull(), // added, dropped, withdrawn, grade_change, etc.

  // Before/after values
  previousStatus: varchar("previous_status", { length: 20 }),
  newStatus: varchar("new_status", { length: 20 }),
  previousGrade: varchar("previous_grade", { length: 5 }),
  newGrade: varchar("new_grade", { length: 5 }),

  // Who made the change
  changedBy: uuid("changed_by").references(() => users.id),
  changeReason: text("change_reason"),

  // Financial impact
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  chargeAmount: decimal("charge_amount", { precision: 10, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  registrationIdx: index("registration_change_logs_registration_idx").on(table.registrationId),
  createdAtIdx: index("registration_change_logs_created_at_idx").on(table.createdAt),
}));

// Attendance Record (optional module)
export const attendanceRecords = enrollmentSchema.table("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id),

  classDate: date("class_date").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // present, absent, late, excused

  // Time tracking (for labs, etc.)
  checkInTime: timestamp("check_in_time", { withTimezone: true }),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),

  recordedBy: uuid("recorded_by").references(() => users.id),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  registrationDateIdx: index("attendance_records_registration_date_idx").on(table.registrationId, table.classDate),
}));

// ============================================================================
// REGISTRATION TIME TICKETS & PRIORITY REGISTRATION
// ============================================================================

// Priority Groups - define registration priority categories (veterans, disabilities, athletes, etc.)
export const priorityGroups = enrollmentSchema.table("priority_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 30 }).notNull(), // VETERAN, DISABILITY, ATHLETE, HONORS, SENIOR, JUNIOR, etc.
  name: varchar("name", { length: 100 }).notNull(), // "Veterans", "Students with Disabilities"
  description: text("description"),

  // Lower number = higher priority (earlier registration)
  priorityLevel: integer("priority_level").notNull(),

  // How is membership determined?
  membershipType: varchar("membership_type", { length: 30 }).default("manual"),
  // manual, attribute, credits, standing

  // For attribute-based: which student attribute to check
  membershipAttribute: varchar("membership_attribute", { length: 50 }),
  // e.g., "isVeteran", "hasDisabilityAccommodation", "isAthlete"

  // For credits-based: minimum credits earned
  minimumCredits: decimal("minimum_credits", { precision: 5, scale: 2 }),

  // Is this a federally mandated priority (ADA, VA)?
  isFederallyMandated: boolean("is_federally_mandated").default(false),

  isActive: boolean("is_active").default(true).notNull(),

  // Temporal tracking (aligned with scheduling.sectionAssignments pattern)
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current
  changedBy: uuid("changed_by").references(() => users.id),
  changeReason: varchar("change_reason", { length: 100 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionCodeIdx: uniqueIndex("priority_groups_institution_code_idx").on(table.institutionId, table.code),
  priorityLevelIdx: index("priority_groups_priority_level_idx").on(table.institutionId, table.priorityLevel),
  // Partial index for current (active) records
  currentIdx: index("priority_groups_current_idx")
    .on(table.institutionId)
    .where(sql`valid_to IS NULL`),
}));

// Registration Appointments - assigned registration time windows per student/term
export const registrationAppointments = enrollmentSchema.table("registration_appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  // Priority group assignment (if applicable)
  priorityGroupId: uuid("priority_group_id").references(() => priorityGroups.id),

  // Calculated priority level (combines group + credits)
  effectivePriorityLevel: integer("effective_priority_level").notNull(),

  // Appointment window
  appointmentStart: timestamp("appointment_start", { withTimezone: true }).notNull(),
  appointmentEnd: timestamp("appointment_end", { withTimezone: true }),

  // Credits earned at time of generation (for credit-based priority)
  creditsEarnedAtGeneration: decimal("credits_earned_at_generation", { precision: 5, scale: 2 }),

  // Generation tracking
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  generatedBy: uuid("generated_by").references(() => users.id),

  // Manual override
  isManualOverride: boolean("is_manual_override").default(false),
  overrideReason: text("override_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTermIdx: uniqueIndex("registration_appointments_student_term_idx").on(table.studentId, table.termId),
  termAppointmentIdx: index("registration_appointments_term_appointment_idx").on(table.termId, table.appointmentStart),
  priorityGroupIdx: index("registration_appointments_priority_group_idx").on(table.priorityGroupId),
}));

// ============================================================================
// HOLD TYPES CONFIGURATION
// ============================================================================

// Hold Types - configurable hold type definitions
export const holdTypes = enrollmentSchema.table("hold_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 30 }).notNull(), // FIN_BAL, IMMU, ADVIS, DISC
  name: varchar("name", { length: 100 }).notNull(), // "Financial Balance", "Immunization Hold"
  description: text("description"),

  // Category for grouping
  category: varchar("category", { length: 20 }).notNull(), // academic, financial, administrative, disciplinary

  // What does this hold block?
  blocksRegistration: boolean("blocks_registration").default(true),
  blocksGrades: boolean("blocks_grades").default(false),
  blocksTranscript: boolean("blocks_transcript").default(false),
  blocksDiploma: boolean("blocks_diploma").default(false),
  blocksGraduation: boolean("blocks_graduation").default(false),

  // Who can release this hold?
  releaseAuthority: varchar("release_authority", { length: 100 }), // "Bursar's Office", "Registrar"
  releaseAuthorityEmail: varchar("release_authority_email", { length: 200 }),

  // Student-facing resolution instructions
  resolutionInstructions: text("resolution_instructions"),
  resolutionUrl: varchar("resolution_url", { length: 500 }), // Link to self-service resolution

  // For automated holds
  isAutomated: boolean("is_automated").default(false),
  automationRule: jsonb("automation_rule").$type<HoldAutomationRule>(),

  // Severity for display
  severity: varchar("severity", { length: 20 }).default("standard"), // low, standard, high, critical

  isActive: boolean("is_active").default(true).notNull(),

  // Temporal tracking (aligned with scheduling.sectionAssignments pattern)
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current
  changedBy: uuid("changed_by").references(() => users.id),
  changeReason: varchar("change_reason", { length: 100 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionCodeIdx: uniqueIndex("hold_types_institution_code_idx").on(table.institutionId, table.code),
  categoryIdx: index("hold_types_category_idx").on(table.institutionId, table.category),
  // Partial index for current (active) records
  currentIdx: index("hold_types_current_idx")
    .on(table.institutionId)
    .where(sql`valid_to IS NULL`),
}));

// Interface for hold automation rules
export interface HoldAutomationRule {
  type: "balance_threshold" | "missing_document" | "academic_standing" | "custom";
  // For balance threshold
  balanceThreshold?: number;
  balanceAgeDays?: number;
  // For academic standing
  standingValues?: string[];
  // Custom SQL or condition
  customCondition?: string;
}

// ============================================================================
// CENSUS & ENROLLMENT REPORTING
// ============================================================================

// Census Snapshots - point-in-time enrollment snapshots for reporting
export const censusSnapshots = enrollmentSchema.table("census_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  sessionId: uuid("session_id").references(() => termSessions.id),

  // Snapshot date
  snapshotDate: date("snapshot_date").notNull(),
  snapshotType: varchar("snapshot_type", { length: 30 }).default("census"),
  // census, midterm, final, custom

  // Summary counts
  totalHeadcount: integer("total_headcount"),
  fullTimeCount: integer("full_time_count"),
  partTimeCount: integer("part_time_count"),
  halfTimeCount: integer("half_time_count"),
  lessThanHalfTimeCount: integer("less_than_half_time_count"),

  // FTE calculation
  totalFte: decimal("total_fte", { precision: 10, scale: 2 }),
  undergraduateFte: decimal("undergraduate_fte", { precision: 10, scale: 2 }),
  graduateFte: decimal("graduate_fte", { precision: 10, scale: 2 }),

  // Credit hours
  totalCreditHours: decimal("total_credit_hours", { precision: 12, scale: 2 }),

  // Demographics breakdown (for IPEDS)
  demographicsBreakdown: jsonb("demographics_breakdown").$type<CensusDemographics>(),

  // Detailed snapshot data (individual student records at census)
  snapshotData: jsonb("snapshot_data").$type<CensusStudentRecord[]>(),

  // Generation info
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  generatedBy: uuid("generated_by").references(() => users.id),

  // Status
  status: varchar("status", { length: 20 }).default("draft"),
  // draft, finalized, submitted

  // NSC file generation
  nscFileGeneratedAt: timestamp("nsc_file_generated_at", { withTimezone: true }),
  nscFileName: varchar("nsc_file_name", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  termDateIdx: uniqueIndex("census_snapshots_term_date_idx").on(table.termId, table.snapshotDate),
  sessionIdx: index("census_snapshots_session_idx").on(table.sessionId),
}));

// Census Snapshot Details - normalized student-level records for better scalability
// Replaces JSONB snapshotData array for improved query performance with large enrollments
export const censusSnapshotDetails = enrollmentSchema.table("census_snapshot_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id")
    .notNull()
    .references(() => censusSnapshots.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  // Enrollment data at census point
  enrollmentStatus: varchar("enrollment_status", { length: 20 }).notNull(),
  enrollmentType: varchar("enrollment_type", { length: 20 }).notNull(), // full_time, half_time, less_than_half_time
  creditHours: decimal("credit_hours", { precision: 5, scale: 2 }).notNull(),
  fte: decimal("fte", { precision: 5, scale: 3 }).notNull(),

  // Program/level info for IPEDS reporting
  programId: uuid("program_id").references(() => studentPrograms.id),
  level: varchar("level", { length: 20 }), // undergraduate, graduate, professional

  // Demographics captured at census (for historical accuracy)
  gender: varchar("gender", { length: 10 }),
  ethnicity: varchar("ethnicity", { length: 50 }),
  residency: varchar("residency", { length: 20 }), // in_state, out_of_state, international
  ageAtCensus: integer("age_at_census"),

  // NSC reporting fields
  nscEnrollmentStatus: varchar("nsc_enrollment_status", { length: 1 }), // F, H, L, A, W, D, G
  nscProgramCip: varchar("nsc_program_cip", { length: 10 }), // CIP code

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  snapshotStudentIdx: uniqueIndex("census_snapshot_details_snapshot_student_idx").on(table.snapshotId, table.studentId),
  studentIdx: index("census_snapshot_details_student_idx").on(table.studentId),
  enrollmentTypeIdx: index("census_snapshot_details_enrollment_type_idx").on(table.snapshotId, table.enrollmentType),
  levelIdx: index("census_snapshot_details_level_idx").on(table.snapshotId, table.level),
}));

// Interfaces for census data
export interface CensusDemographics {
  byGender?: { male: number; female: number; nonBinary?: number; unknown: number };
  byEthnicity?: Record<string, number>;
  byAge?: Record<string, number>;
  byLevel?: { undergraduate: number; graduate: number; professional?: number };
  byResidency?: { inState: number; outOfState: number; international: number };
  byProgram?: Record<string, number>;
}

export interface CensusStudentRecord {
  studentId: string;
  enrollmentStatus: string;
  enrollmentType: string; // full_time, half_time, etc.
  creditHours: number;
  fte: number;
  programId?: string;
  level?: string;
}

// ============================================================================
// GRADE CHANGE REQUESTS
// ============================================================================

/**
 * Grade Change Requests - tracks requests to modify posted grades
 * Provides full audit trail for grade corrections
 */
export const gradeChangeRequests = enrollmentSchema.table("grade_change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),

  // The registration being modified
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id, { onDelete: "cascade" }),

  // Original grade info (captured at time of request)
  originalGradeCode: varchar("original_grade_code", { length: 5 }),
  originalGradePoints: decimal("original_grade_points", { precision: 4, scale: 3 }),

  // Requested new grade
  requestedGradeCode: varchar("requested_grade_code", { length: 5 }).notNull(),
  requestedGradePoints: decimal("requested_grade_points", { precision: 4, scale: 3 }),

  // Request type
  changeType: varchar("change_type", { length: 30 }).notNull(), // "correction", "incomplete_conversion", "appeal", "administrative"

  // Reason for the change (required)
  reason: text("reason").notNull(),

  // Supporting documentation reference
  documentationUrl: varchar("documentation_url", { length: 500 }),
  documentationNotes: text("documentation_notes"),

  // Workflow status
  status: varchar("status", { length: 20 }).default("pending").notNull(), // "pending", "approved", "denied", "applied"

  // Request info
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

  // Review info
  reviewedBy: uuid("reviewed_by")
    .references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  denialReason: text("denial_reason"),

  // Application info (when grade is actually changed)
  appliedBy: uuid("applied_by")
    .references(() => users.id),
  appliedAt: timestamp("applied_at", { withTimezone: true }),

  // For incomplete conversions - deadline tracking
  incompleteDeadline: date("incomplete_deadline"),
  incompleteDefaultGrade: varchar("incomplete_default_grade", { length: 5 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  registrationIdx: index("grade_change_requests_registration_idx").on(table.registrationId),
  statusIdx: index("grade_change_requests_status_idx").on(table.status),
  requestedByIdx: index("grade_change_requests_requested_by_idx").on(table.requestedBy),
  changeTypeIdx: index("grade_change_requests_change_type_idx").on(table.changeType),
}));

// ============================================================================
// ARTICULATION AGREEMENTS
// ============================================================================

/**
 * External Institutions - master list of external colleges/universities
 * Used for standardized transfer credit evaluation
 */
export const externalInstitutions = enrollmentSchema.table("external_institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Standardized codes
  ficeCode: varchar("fice_code", { length: 10 }), // Federal ID code
  opeId: varchar("ope_id", { length: 10 }), // Office of Postsecondary Education ID
  ceebCode: varchar("ceeb_code", { length: 10 }), // College Board code
  ipedsId: varchar("ipeds_id", { length: 10 }), // IPEDS unit ID

  // Institution info
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),
  city: varchar("city", { length: 100 }),
  stateProvince: varchar("state_province", { length: 50 }),
  country: varchar("country", { length: 2 }).default("US"),

  // Classification
  institutionType: varchar("institution_type", { length: 30 }).notNull(), // "4year_public", "4year_private", "2year", "technical", "international"
  accreditingBody: varchar("accrediting_body", { length: 100 }),
  isRegionallyAccredited: boolean("is_regionally_accredited").default(true),

  // Status
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ficeIdx: index("external_institutions_fice_idx").on(table.ficeCode),
  ceebIdx: index("external_institutions_ceeb_idx").on(table.ceebCode),
  nameIdx: index("external_institutions_name_idx").on(table.name),
  institutionTypeIdx: index("external_institutions_type_idx").on(table.institutionId, table.institutionType),
}));

/**
 * Articulation Agreements - formal agreements between institutions
 * Defines transfer credit policies with external institutions
 */
export const articulationAgreements = enrollmentSchema.table("articulation_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  externalInstitutionId: uuid("external_institution_id")
    .notNull()
    .references(() => externalInstitutions.id, { onDelete: "cascade" }),

  // Agreement details
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  agreementType: varchar("agreement_type", { length: 30 }).notNull(), // "general", "program_specific", "course_specific", "consortium"

  // For program-specific agreements
  programId: uuid("program_id"), // References programs table if program-specific

  // Effective dates
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),

  // Agreement document
  documentUrl: varchar("document_url", { length: 500 }),

  // Auto-apply flag - if true, equivalencies automatically apply to new transfer credits
  autoApply: boolean("auto_apply").default(true).notNull(),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // "draft", "active", "expired", "terminated"

  // Approval tracking
  approvedBy: uuid("approved_by")
    .references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionExternalIdx: index("articulation_agreements_inst_external_idx").on(table.institutionId, table.externalInstitutionId),
  statusIdx: index("articulation_agreements_status_idx").on(table.status),
  effectiveIdx: index("articulation_agreements_effective_idx").on(table.effectiveFrom, table.effectiveTo),
}));

/**
 * Course Equivalency Rules - defines how external courses map to internal courses
 * Used for automatic transfer credit evaluation
 */
export const courseEquivalencyRules = enrollmentSchema.table("course_equivalency_rules", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Parent agreement (optional - can be standalone rules)
  agreementId: uuid("agreement_id")
    .references(() => articulationAgreements.id, { onDelete: "cascade" }),

  // Or standalone for an external institution
  externalInstitutionId: uuid("external_institution_id")
    .references(() => externalInstitutions.id, { onDelete: "cascade" }),

  // External course info (pattern matching supported)
  externalCourseCode: varchar("external_course_code", { length: 30 }).notNull(), // Can use wildcards like "MATH*"
  externalCourseTitle: varchar("external_course_title", { length: 200 }),
  externalCreditsMin: decimal("external_credits_min", { precision: 4, scale: 2 }),
  externalCreditsMax: decimal("external_credits_max", { precision: 4, scale: 2 }),

  // Internal equivalent
  equivalentCourseId: uuid("equivalent_course_id")
    .references(() => courses.id),

  // For general elective credit (no specific course equivalent)
  isElectiveCredit: boolean("is_elective_credit").default(false),
  electiveCreditSubject: varchar("elective_credit_subject", { length: 50 }), // e.g., "ELEC", "GEN"
  electiveCreditLevel: varchar("elective_credit_level", { length: 10 }), // "100", "200", etc.

  // Credits to award
  transferCreditsAwarded: decimal("transfer_credits_awarded", { precision: 4, scale: 2 }).notNull(),

  // Minimum grade required
  minimumGrade: varchar("minimum_grade", { length: 5 }),

  // Priority for matching (higher = checked first)
  priority: integer("priority").default(0),

  // Status
  isActive: boolean("is_active").default(true).notNull(),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  agreementIdx: index("course_equivalency_rules_agreement_idx").on(table.agreementId),
  externalInstIdx: index("course_equivalency_rules_external_inst_idx").on(table.externalInstitutionId),
  courseCodeIdx: index("course_equivalency_rules_course_code_idx").on(table.externalCourseCode),
  equivalentCourseIdx: index("course_equivalency_rules_equivalent_idx").on(table.equivalentCourseId),
}));

// Relations
export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  student: one(students, {
    fields: [registrations.studentId],
    references: [students.id],
  }),
  section: one(sections, {
    fields: [registrations.sectionId],
    references: [sections.id],
  }),
  term: one(terms, {
    fields: [registrations.termId],
    references: [terms.id],
  }),
  grade: one(grades, {
    fields: [registrations.gradeId],
    references: [grades.id],
  }),
  midtermGrade: one(grades, {
    fields: [registrations.midtermGradeId],
    references: [grades.id],
  }),
  overrideByUser: one(users, {
    fields: [registrations.overrideBy],
    references: [users.id],
  }),
  changeLogs: many(registrationChangeLogs),
  attendanceRecords: many(attendanceRecords),
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  student: one(students, {
    fields: [waitlistEntries.studentId],
    references: [students.id],
  }),
  section: one(sections, {
    fields: [waitlistEntries.sectionId],
    references: [sections.id],
  }),
}));

export const registrationHoldsRelations = relations(registrationHolds, ({ one }) => ({
  student: one(students, {
    fields: [registrationHolds.studentId],
    references: [students.id],
  }),
  holdTypeConfig: one(holdTypes, {
    fields: [registrationHolds.holdTypeId],
    references: [holdTypes.id],
  }),
  resolvedByUser: one(users, {
    fields: [registrationHolds.resolvedBy],
    references: [users.id],
  }),
  placedByUser: one(users, {
    fields: [registrationHolds.placedBy],
    references: [users.id],
  }),
}));

export const termEnrollmentsRelations = relations(termEnrollments, ({ one }) => ({
  student: one(students, {
    fields: [termEnrollments.studentId],
    references: [students.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [termEnrollments.studentProgramId],
    references: [studentPrograms.id],
  }),
  term: one(terms, {
    fields: [termEnrollments.termId],
    references: [terms.id],
  }),
}));

export const transferCreditsRelations = relations(transferCredits, ({ one }) => ({
  student: one(students, {
    fields: [transferCredits.studentId],
    references: [students.id],
  }),
  equivalentCourse: one(courses, {
    fields: [transferCredits.equivalentCourseId],
    references: [courses.id],
  }),
  evaluatedByUser: one(users, {
    fields: [transferCredits.evaluatedBy],
    references: [users.id],
  }),
}));

export const testScoresRelations = relations(testScores, ({ one }) => ({
  student: one(students, {
    fields: [testScores.studentId],
    references: [students.id],
  }),
  equivalentCourse: one(courses, {
    fields: [testScores.equivalentCourseId],
    references: [courses.id],
  }),
}));

export const registrationChangeLogsRelations = relations(registrationChangeLogs, ({ one }) => ({
  registration: one(registrations, {
    fields: [registrationChangeLogs.registrationId],
    references: [registrations.id],
  }),
  changedByUser: one(users, {
    fields: [registrationChangeLogs.changedBy],
    references: [users.id],
  }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  registration: one(registrations, {
    fields: [attendanceRecords.registrationId],
    references: [registrations.id],
  }),
  recordedByUser: one(users, {
    fields: [attendanceRecords.recordedBy],
    references: [users.id],
  }),
}));

// Priority Groups Relations
export const priorityGroupsRelations = relations(priorityGroups, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [priorityGroups.institutionId],
    references: [institutions.id],
  }),
  changedByUser: one(users, {
    fields: [priorityGroups.changedBy],
    references: [users.id],
  }),
  appointments: many(registrationAppointments),
}));

// Registration Appointments Relations
export const registrationAppointmentsRelations = relations(registrationAppointments, ({ one }) => ({
  institution: one(institutions, {
    fields: [registrationAppointments.institutionId],
    references: [institutions.id],
  }),
  student: one(students, {
    fields: [registrationAppointments.studentId],
    references: [students.id],
  }),
  term: one(terms, {
    fields: [registrationAppointments.termId],
    references: [terms.id],
  }),
  priorityGroup: one(priorityGroups, {
    fields: [registrationAppointments.priorityGroupId],
    references: [priorityGroups.id],
  }),
  generatedByUser: one(users, {
    fields: [registrationAppointments.generatedBy],
    references: [users.id],
  }),
}));

// Hold Types Relations
export const holdTypesRelations = relations(holdTypes, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [holdTypes.institutionId],
    references: [institutions.id],
  }),
  changedByUser: one(users, {
    fields: [holdTypes.changedBy],
    references: [users.id],
  }),
  holds: many(registrationHolds),
}));

// Census Snapshots Relations
export const censusSnapshotsRelations = relations(censusSnapshots, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [censusSnapshots.institutionId],
    references: [institutions.id],
  }),
  term: one(terms, {
    fields: [censusSnapshots.termId],
    references: [terms.id],
  }),
  session: one(termSessions, {
    fields: [censusSnapshots.sessionId],
    references: [termSessions.id],
  }),
  generatedByUser: one(users, {
    fields: [censusSnapshots.generatedBy],
    references: [users.id],
  }),
  details: many(censusSnapshotDetails),
}));

// Census Snapshot Details Relations
export const censusSnapshotDetailsRelations = relations(censusSnapshotDetails, ({ one }) => ({
  snapshot: one(censusSnapshots, {
    fields: [censusSnapshotDetails.snapshotId],
    references: [censusSnapshots.id],
  }),
  student: one(students, {
    fields: [censusSnapshotDetails.studentId],
    references: [students.id],
  }),
  program: one(studentPrograms, {
    fields: [censusSnapshotDetails.programId],
    references: [studentPrograms.id],
  }),
}));

// Grade Change Requests Relations
export const gradeChangeRequestsRelations = relations(gradeChangeRequests, ({ one }) => ({
  registration: one(registrations, {
    fields: [gradeChangeRequests.registrationId],
    references: [registrations.id],
  }),
  requester: one(users, {
    fields: [gradeChangeRequests.requestedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [gradeChangeRequests.reviewedBy],
    references: [users.id],
  }),
  applier: one(users, {
    fields: [gradeChangeRequests.appliedBy],
    references: [users.id],
  }),
}));

// External Institutions Relations
export const externalInstitutionsRelations = relations(externalInstitutions, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [externalInstitutions.institutionId],
    references: [institutions.id],
  }),
  agreements: many(articulationAgreements),
  equivalencyRules: many(courseEquivalencyRules),
}));

// Articulation Agreements Relations
export const articulationAgreementsRelations = relations(articulationAgreements, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [articulationAgreements.institutionId],
    references: [institutions.id],
  }),
  externalInstitution: one(externalInstitutions, {
    fields: [articulationAgreements.externalInstitutionId],
    references: [externalInstitutions.id],
  }),
  approver: one(users, {
    fields: [articulationAgreements.approvedBy],
    references: [users.id],
  }),
  equivalencyRules: many(courseEquivalencyRules),
}));

// Course Equivalency Rules Relations
export const courseEquivalencyRulesRelations = relations(courseEquivalencyRules, ({ one }) => ({
  agreement: one(articulationAgreements, {
    fields: [courseEquivalencyRules.agreementId],
    references: [articulationAgreements.id],
  }),
  externalInstitution: one(externalInstitutions, {
    fields: [courseEquivalencyRules.externalInstitutionId],
    references: [externalInstitutions.id],
  }),
  equivalentCourse: one(courses, {
    fields: [courseEquivalencyRules.equivalentCourseId],
    references: [courses.id],
  }),
}));
