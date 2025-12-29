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
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions, campuses } from "./core.js";
import { users } from "./identity.js";

// Student schema for student records
export const studentSchema = pgSchema("student");

// Student record - core biographical/demographic data
export const students = studentSchema.table("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Link to user account (for portal access)
  userId: uuid("user_id").references(() => users.id),

  // Student ID
  studentId: varchar("student_id", { length: 20 }).notNull(), // e.g., "S00123456"

  // Name
  legalFirstName: varchar("legal_first_name", { length: 100 }).notNull(),
  legalMiddleName: varchar("legal_middle_name", { length: 100 }),
  legalLastName: varchar("legal_last_name", { length: 100 }).notNull(),
  suffix: varchar("suffix", { length: 20 }),
  preferredFirstName: varchar("preferred_first_name", { length: 100 }),
  preferredLastName: varchar("preferred_last_name", { length: 100 }),
  previousLastName: varchar("previous_last_name", { length: 100 }), // Maiden name

  // Demographics
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 20 }), // M, F, X, U
  pronouns: varchar("pronouns", { length: 50 }),

  // Federal reporting demographics
  hispanicLatino: boolean("hispanic_latino"),
  races: jsonb("races").$type<string[]>(), // Array of race codes

  // Citizenship
  citizenshipStatus: varchar("citizenship_status", { length: 20 }), // US_CITIZEN, PERMANENT_RESIDENT, INTERNATIONAL
  citizenshipCountry: varchar("citizenship_country", { length: 2 }),
  visaType: varchar("visa_type", { length: 10 }), // F-1, J-1, etc.

  // SSN (encrypted, for financial aid and 1098-T)
  ssnEncrypted: varchar("ssn_encrypted", { length: 255 }),
  ssnLast4: varchar("ssn_last_4", { length: 4 }), // For display purposes

  // Contact - Primary
  primaryEmail: varchar("primary_email", { length: 255 }).notNull(),
  institutionalEmail: varchar("institutional_email", { length: 255 }),
  primaryPhone: varchar("primary_phone", { length: 20 }),
  mobilePhone: varchar("mobile_phone", { length: 20 }),

  // Emergency contact
  emergencyContactName: varchar("emergency_contact_name", { length: 200 }),
  emergencyContactRelationship: varchar("emergency_contact_relationship", { length: 50 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),

  // Photo
  photoUrl: varchar("photo_url", { length: 500 }),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, inactive, graduated, withdrawn, deceased
  firstEnrollmentDate: date("first_enrollment_date"),
  mostRecentEnrollmentDate: date("most_recent_enrollment_date"),

  // FERPA
  ferpaBlock: boolean("ferpa_block").default(false), // Directory information restriction
  ferpaBlockDate: date("ferpa_block_date"),

  // First generation (for reporting)
  firstGeneration: boolean("first_generation"),

  // Military/Veteran status
  veteranStatus: varchar("veteran_status", { length: 30 }),

  // Deceased
  deceasedDate: date("deceased_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdInstitutionIdx: index("students_student_id_institution_idx").on(table.studentId, table.institutionId),
  emailIdx: index("students_email_idx").on(table.primaryEmail),
  userIdx: index("students_user_idx").on(table.userId),
  nameIdx: index("students_name_idx").on(table.legalLastName, table.legalFirstName),
}));

// Student Addresses
export const studentAddresses = studentSchema.table("student_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  addressType: varchar("address_type", { length: 20 }).notNull(), // permanent, mailing, local, billing, emergency

  address1: varchar("address_1", { length: 100 }).notNull(),
  address2: varchar("address_2", { length: 100 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 2 }).default("US").notNull(),
  county: varchar("county", { length: 100 }),

  isPrimary: boolean("is_primary").default(false),

  // Effective dates
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),

  // For international address validation
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTypeIdx: index("student_addresses_student_type_idx").on(table.studentId, table.addressType),
}));

// Student Program - enrollment in a degree program
export const studentPrograms = studentSchema.table("student_programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  programId: uuid("program_id").notNull(), // References curriculum.programs

  campusId: uuid("campus_id").references(() => campuses.id),

  // Program details
  catalogYearId: uuid("catalog_year_id"), // Catalog year student is following
  concentrationId: uuid("concentration_id"), // If program has concentrations

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, graduated, withdrawn, dismissed, leave

  // Enrollment
  admitTermId: uuid("admit_term_id"),
  startDate: date("start_date"),
  expectedGraduationDate: date("expected_graduation_date"),
  actualGraduationDate: date("actual_graduation_date"),

  // Academic standing
  academicStanding: varchar("academic_standing", { length: 30 }), // good_standing, probation, suspension, dismissal

  // Primary program indicator
  isPrimary: boolean("is_primary").default(true),

  // Degree awarded
  degreeAwardedDate: date("degree_awarded_date"),
  diplomaName: varchar("diploma_name", { length: 200 }), // Name as it appears on diploma
  honorsDesignation: varchar("honors_designation", { length: 50 }), // summa cum laude, etc.

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("student_programs_student_idx").on(table.studentId),
  programIdx: index("student_programs_program_idx").on(table.programId),
  statusIdx: index("student_programs_status_idx").on(table.status),
}));

// Student Major/Minor declaration
export const studentMajors = studentSchema.table("student_majors", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentProgramId: uuid("student_program_id")
    .notNull()
    .references(() => studentPrograms.id, { onDelete: "cascade" }),

  majorId: uuid("major_id").notNull(), // References curriculum.majors
  majorType: varchar("major_type", { length: 20 }).notNull(), // major, minor, concentration

  declaredDate: date("declared_date"),
  completedDate: date("completed_date"),

  isPrimary: boolean("is_primary").default(false),
  sortOrder: integer("sort_order").default(0),

  status: varchar("status", { length: 20 }).default("active").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Advisor Assignment
export const studentAdvisors = studentSchema.table("student_advisors", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  advisorId: uuid("advisor_id")
    .notNull()
    .references(() => users.id),

  advisorType: varchar("advisor_type", { length: 30 }).notNull(), // academic, faculty, success_coach, financial_aid

  // For program-specific advisors
  studentProgramId: uuid("student_program_id").references(() => studentPrograms.id),

  isPrimary: boolean("is_primary").default(false),

  assignedDate: date("assigned_date"),
  endDate: date("end_date"),

  status: varchar("status", { length: 20 }).default("active").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("student_advisors_student_idx").on(table.studentId),
  advisorIdx: index("student_advisors_advisor_idx").on(table.advisorId),
}));

// Student Attribute (flexible attributes for custom fields)
export const studentAttributes = studentSchema.table("student_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  attributeCode: varchar("attribute_code", { length: 50 }).notNull(),
  attributeValue: text("attribute_value"),

  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentAttributeIdx: index("student_attributes_student_attribute_idx").on(table.studentId, table.attributeCode),
}));

// Student Cohort membership
export const studentCohorts = studentSchema.table("student_cohorts", {
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  cohortId: uuid("cohort_id").notNull(), // References cohorts table

  joinedDate: date("joined_date"),
  leftDate: date("left_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.studentId, table.cohortId] }),
}));

// Cohort definition
export const cohorts = studentSchema.table("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),

  cohortType: varchar("cohort_type", { length: 30 }), // admit_term, program, custom

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Student Note/Comment
export const studentNotes = studentSchema.table("student_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),

  noteType: varchar("note_type", { length: 30 }), // general, academic, financial, advising
  subject: varchar("subject", { length: 200 }),
  content: text("content").notNull(),

  // Visibility
  isConfidential: boolean("is_confidential").default(false),
  visibleToStudent: boolean("visible_to_student").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("student_notes_student_idx").on(table.studentId),
  typeIdx: index("student_notes_type_idx").on(table.noteType),
}));

// Student GPA Summary (denormalized for performance)
export const studentGpaSummary = studentSchema.table("student_gpa_summary", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  studentProgramId: uuid("student_program_id")
    .references(() => studentPrograms.id, { onDelete: "cascade" }),

  // Cumulative totals
  cumulativeAttemptedCredits: decimal("cumulative_attempted_credits", { precision: 8, scale: 2 }).default("0"),
  cumulativeEarnedCredits: decimal("cumulative_earned_credits", { precision: 8, scale: 2 }).default("0"),
  cumulativeQualityPoints: decimal("cumulative_quality_points", { precision: 10, scale: 2 }).default("0"),
  cumulativeGpa: decimal("cumulative_gpa", { precision: 4, scale: 3 }),

  // In-progress
  inProgressCredits: decimal("in_progress_credits", { precision: 8, scale: 2 }).default("0"),

  // Transfer credits
  transferCredits: decimal("transfer_credits", { precision: 8, scale: 2 }).default("0"),

  // Last term
  lastTermId: uuid("last_term_id"),
  lastTermAttemptedCredits: decimal("last_term_attempted_credits", { precision: 8, scale: 2 }),
  lastTermEarnedCredits: decimal("last_term_earned_credits", { precision: 8, scale: 2 }),
  lastTermGpa: decimal("last_term_gpa", { precision: 4, scale: 3 }),

  // Last calculated
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("student_gpa_summary_student_idx").on(table.studentId),
  studentProgramIdx: index("student_gpa_summary_student_program_idx").on(table.studentProgramId),
}));

// Relations
export const studentsRelations = relations(students, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [students.institutionId],
    references: [institutions.id],
  }),
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  addresses: many(studentAddresses),
  programs: many(studentPrograms),
  advisors: many(studentAdvisors),
  attributes: many(studentAttributes),
  cohorts: many(studentCohorts),
  notes: many(studentNotes),
  gpaSummary: many(studentGpaSummary),
}));

export const studentAddressesRelations = relations(studentAddresses, ({ one }) => ({
  student: one(students, {
    fields: [studentAddresses.studentId],
    references: [students.id],
  }),
}));

export const studentProgramsRelations = relations(studentPrograms, ({ one, many }) => ({
  student: one(students, {
    fields: [studentPrograms.studentId],
    references: [students.id],
  }),
  campus: one(campuses, {
    fields: [studentPrograms.campusId],
    references: [campuses.id],
  }),
  majors: many(studentMajors),
  advisors: many(studentAdvisors),
}));

export const studentMajorsRelations = relations(studentMajors, ({ one }) => ({
  studentProgram: one(studentPrograms, {
    fields: [studentMajors.studentProgramId],
    references: [studentPrograms.id],
  }),
}));

export const studentAdvisorsRelations = relations(studentAdvisors, ({ one }) => ({
  student: one(students, {
    fields: [studentAdvisors.studentId],
    references: [students.id],
  }),
  advisor: one(users, {
    fields: [studentAdvisors.advisorId],
    references: [users.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [studentAdvisors.studentProgramId],
    references: [studentPrograms.id],
  }),
}));

export const studentAttributesRelations = relations(studentAttributes, ({ one }) => ({
  student: one(students, {
    fields: [studentAttributes.studentId],
    references: [students.id],
  }),
}));

export const studentCohortsRelations = relations(studentCohorts, ({ one }) => ({
  student: one(students, {
    fields: [studentCohorts.studentId],
    references: [students.id],
  }),
  cohort: one(cohorts, {
    fields: [studentCohorts.cohortId],
    references: [cohorts.id],
  }),
}));

export const cohortsRelations = relations(cohorts, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [cohorts.institutionId],
    references: [institutions.id],
  }),
  students: many(studentCohorts),
}));

export const studentNotesRelations = relations(studentNotes, ({ one }) => ({
  student: one(students, {
    fields: [studentNotes.studentId],
    references: [students.id],
  }),
  createdByUser: one(users, {
    fields: [studentNotes.createdBy],
    references: [users.id],
  }),
}));

export const studentGpaSummaryRelations = relations(studentGpaSummary, ({ one }) => ({
  student: one(students, {
    fields: [studentGpaSummary.studentId],
    references: [students.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [studentGpaSummary.studentProgramId],
    references: [studentPrograms.id],
  }),
}));

// =============================================================================
// Academic Standing
// =============================================================================

/**
 * Academic Standing Status values used across the system
 */
export type AcademicStandingStatus =
  | "good_standing"
  | "academic_warning"
  | "academic_probation"
  | "academic_suspension"
  | "academic_dismissal"
  | "reinstated";

/**
 * Academic Standing Policy - defines thresholds and rules for standing determination
 * Each institution can have different policies for different levels (undergrad, graduate, etc.)
 */
export const academicStandingPolicies = studentSchema.table("academic_standing_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 30 }).notNull(), // e.g., "UNDERGRAD_STANDARD", "GRADUATE"
  description: text("description"),

  // Applicable level (undergrad, graduate, certificate, etc.)
  levelCode: varchar("level_code", { length: 20 }), // null = applies to all levels

  // GPA Thresholds
  goodStandingMinGpa: decimal("good_standing_min_gpa", { precision: 4, scale: 3 }).default("2.000").notNull(),
  warningMinGpa: decimal("warning_min_gpa", { precision: 4, scale: 3 }), // Below good standing but above probation
  probationMinGpa: decimal("probation_min_gpa", { precision: 4, scale: 3 }), // Below warning/good standing

  // Progression rules
  probationMaxTerms: integer("probation_max_terms").default(2), // Max terms on probation before suspension
  suspensionDurationTerms: integer("suspension_duration_terms").default(1), // How many terms suspended
  maxSuspensions: integer("max_suspensions").default(2), // Max suspensions before dismissal

  // Credit-hour based thresholds (some institutions vary by credits completed)
  thresholdsByCredits: jsonb("thresholds_by_credits").$type<{
    maxCredits: number;
    goodStandingMinGpa: number;
    probationMinGpa?: number;
  }[]>(),

  // Additional rules
  requiresMinimumCredits: boolean("requires_minimum_credits").default(false),
  minimumCreditsPerTerm: decimal("minimum_credits_per_term", { precision: 5, scale: 2 }),

  // Evaluation timing
  evaluateAfterEachTerm: boolean("evaluate_after_each_term").default(true).notNull(),

  // Active status
  isActive: boolean("is_active").default(true).notNull(),
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionIdx: index("academic_standing_policies_institution_idx").on(table.institutionId),
  codeIdx: index("academic_standing_policies_code_idx").on(table.institutionId, table.code),
}));

/**
 * Academic Standing History - tracks each standing determination for a student
 * Created after each term ends or when standing is manually adjusted
 */
export const academicStandingHistory = studentSchema.table("academic_standing_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  studentProgramId: uuid("student_program_id")
    .references(() => studentPrograms.id, { onDelete: "cascade" }),

  // Term this standing was determined for
  termId: uuid("term_id").notNull(), // References core.terms

  // Policy used for determination
  policyId: uuid("policy_id")
    .references(() => academicStandingPolicies.id),

  // Standing result
  standing: varchar("standing", { length: 30 }).notNull(), // good_standing, academic_warning, academic_probation, academic_suspension, academic_dismissal, reinstated
  previousStanding: varchar("previous_standing", { length: 30 }),

  // GPA at time of determination
  termGpa: decimal("term_gpa", { precision: 4, scale: 3 }),
  cumulativeGpa: decimal("cumulative_gpa", { precision: 4, scale: 3 }),
  termCreditsAttempted: decimal("term_credits_attempted", { precision: 8, scale: 2 }),
  termCreditsEarned: decimal("term_credits_earned", { precision: 8, scale: 2 }),
  cumulativeCreditsAttempted: decimal("cumulative_credits_attempted", { precision: 8, scale: 2 }),
  cumulativeCreditsEarned: decimal("cumulative_credits_earned", { precision: 8, scale: 2 }),

  // Probation tracking
  consecutiveProbationTerms: integer("consecutive_probation_terms").default(0),
  totalProbationTerms: integer("total_probation_terms").default(0),
  totalSuspensions: integer("total_suspensions").default(0),

  // Reason/notes
  reason: text("reason"), // Auto-generated or manual explanation
  internalNotes: text("internal_notes"), // For staff only

  // Whether this was calculated automatically or manually set
  isAutomatic: boolean("is_automatic").default(true).notNull(),

  // Who made the determination (for manual changes)
  determinedBy: uuid("determined_by").references(() => users.id),
  determinedAt: timestamp("determined_at", { withTimezone: true }).defaultNow().notNull(),

  // Notification tracking
  studentNotifiedAt: timestamp("student_notified_at", { withTimezone: true }),
  notificationMethod: varchar("notification_method", { length: 30 }), // email, letter, portal

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("academic_standing_history_student_idx").on(table.studentId),
  termIdx: index("academic_standing_history_term_idx").on(table.termId),
  studentTermIdx: index("academic_standing_history_student_term_idx").on(table.studentId, table.termId),
  standingIdx: index("academic_standing_history_standing_idx").on(table.standing),
}));

/**
 * Academic Standing Appeals - tracks student appeals of standing decisions
 */
export const academicStandingAppeals = studentSchema.table("academic_standing_appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  standingHistoryId: uuid("standing_history_id")
    .notNull()
    .references(() => academicStandingHistory.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  // Appeal details
  appealDate: date("appeal_date").notNull(),
  appealReason: text("appeal_reason").notNull(),
  supportingDocuments: jsonb("supporting_documents").$type<{
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
  }[]>(),

  // Academic plan (required for some appeals)
  academicPlanSubmitted: boolean("academic_plan_submitted").default(false),
  academicPlanDetails: text("academic_plan_details"),

  // Review process
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, under_review, approved, denied, withdrawn
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),

  // If approved, what is the new standing?
  resultingStanding: varchar("resulting_standing", { length: 30 }),

  // Conditions of approval (if any)
  approvalConditions: text("approval_conditions"),
  conditionsMet: boolean("conditions_met"),
  conditionsMetDate: date("conditions_met_date"),

  // Notification
  studentNotifiedAt: timestamp("student_notified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  standingHistoryIdx: index("academic_standing_appeals_standing_history_idx").on(table.standingHistoryId),
  studentIdx: index("academic_standing_appeals_student_idx").on(table.studentId),
  statusIdx: index("academic_standing_appeals_status_idx").on(table.status),
}));

// Academic Standing Relations
export const academicStandingPoliciesRelations = relations(academicStandingPolicies, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [academicStandingPolicies.institutionId],
    references: [institutions.id],
  }),
  standingHistory: many(academicStandingHistory),
}));

export const academicStandingHistoryRelations = relations(academicStandingHistory, ({ one, many }) => ({
  student: one(students, {
    fields: [academicStandingHistory.studentId],
    references: [students.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [academicStandingHistory.studentProgramId],
    references: [studentPrograms.id],
  }),
  policy: one(academicStandingPolicies, {
    fields: [academicStandingHistory.policyId],
    references: [academicStandingPolicies.id],
  }),
  determinedByUser: one(users, {
    fields: [academicStandingHistory.determinedBy],
    references: [users.id],
  }),
  appeals: many(academicStandingAppeals),
}));

export const academicStandingAppealsRelations = relations(academicStandingAppeals, ({ one }) => ({
  standingHistory: one(academicStandingHistory, {
    fields: [academicStandingAppeals.standingHistoryId],
    references: [academicStandingHistory.id],
  }),
  student: one(students, {
    fields: [academicStandingAppeals.studentId],
    references: [students.id],
  }),
  reviewedByUser: one(users, {
    fields: [academicStandingAppeals.reviewedBy],
    references: [users.id],
  }),
}));
