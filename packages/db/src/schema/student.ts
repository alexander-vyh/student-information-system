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
