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
import { relations } from "drizzle-orm";
import { institutions, terms } from "./core.js";
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
