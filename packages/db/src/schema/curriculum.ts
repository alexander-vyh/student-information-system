import {
  pgTable,
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  date,
  time,
  timestamp,
  integer,
  decimal,
  jsonb,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions, campuses, terms, rooms } from "./core.js";
import { users } from "./identity.js";
import { students } from "./student.js";

// Curriculum schema for academic catalog
export const curriculumSchema = pgSchema("curriculum");

// Academic Organization (College/School)
export const colleges = curriculumSchema.table("colleges", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),

  deanId: uuid("dean_id").references(() => users.id),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Department
export const departments = curriculumSchema.table("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  collegeId: uuid("college_id")
    .notNull()
    .references(() => colleges.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),

  chairId: uuid("chair_id").references(() => users.id),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Subject (course prefix like "CS", "MATH")
export const subjects = curriculumSchema.table("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  departmentId: uuid("department_id")
    .references(() => departments.id),

  code: varchar("code", { length: 10 }).notNull(), // e.g., "CS", "MATH"
  name: varchar("name", { length: 200 }).notNull(),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Degree Type (Bachelor, Master, etc.)
export const degreeTypes = curriculumSchema.table("degree_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 20 }).notNull(), // e.g., "BS", "BA", "MS"
  name: varchar("name", { length: 100 }).notNull(),

  level: varchar("level", { length: 20 }).notNull(), // undergraduate, graduate, doctoral, certificate

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Program (Degree Program)
export const programs = curriculumSchema.table("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id),
  degreeTypeId: uuid("degree_type_id")
    .references(() => degreeTypes.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),

  // CIP code for federal reporting
  cipCode: varchar("cip_code", { length: 20 }),

  // Program details
  description: text("description"),
  totalCredits: decimal("total_credits", { precision: 5, scale: 2 }),
  typicalDuration: integer("typical_duration"), // in semesters/terms

  // For STEM OPT eligibility
  isStem: boolean("is_stem").default(false),

  // Admission requirements summary
  admissionRequirements: text("admission_requirements"),

  // Program status
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, inactive, teach_out
  effectiveStartDate: date("effective_start_date"),
  effectiveEndDate: date("effective_end_date"),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  codeIdx: index("programs_code_idx").on(table.code),
  cipIdx: index("programs_cip_idx").on(table.cipCode),
}));

// Major/Minor definition
export const majors = curriculumSchema.table("majors", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  departmentId: uuid("department_id")
    .references(() => departments.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),

  majorType: varchar("major_type", { length: 20 }).notNull(), // major, minor, concentration

  cipCode: varchar("cip_code", { length: 20 }),
  totalCredits: decimal("total_credits", { precision: 5, scale: 2 }),

  description: text("description"),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Catalog Year
export const catalogYears = curriculumSchema.table("catalog_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 20 }).notNull(), // e.g., "2024-2025"
  name: varchar("name", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  isCurrent: boolean("is_current").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Course (master course definition)
export const courses = curriculumSchema.table("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  departmentId: uuid("department_id")
    .references(() => departments.id),

  // Course identifier
  courseNumber: varchar("course_number", { length: 20 }).notNull(), // e.g., "101", "4300"
  title: varchar("title", { length: 200 }).notNull(),
  shortTitle: varchar("short_title", { length: 50 }),

  // Full course code (computed or denormalized)
  courseCode: varchar("course_code", { length: 30 }), // e.g., "CS 101"

  // Credits
  creditHoursMin: decimal("credit_hours_min", { precision: 4, scale: 2 }).notNull(),
  creditHoursMax: decimal("credit_hours_max", { precision: 4, scale: 2 }),
  creditHoursDefault: decimal("credit_hours_default", { precision: 4, scale: 2 }),

  // Billing hours (may differ from credit hours)
  billingHoursMin: decimal("billing_hours_min", { precision: 4, scale: 2 }),
  billingHoursMax: decimal("billing_hours_max", { precision: 4, scale: 2 }),

  // Contact hours
  lectureHours: decimal("lecture_hours", { precision: 4, scale: 2 }),
  labHours: decimal("lab_hours", { precision: 4, scale: 2 }),

  description: text("description"),

  // Course level
  courseLevel: varchar("course_level", { length: 20 }), // undergraduate, graduate, doctoral

  // Grade mode
  gradeMode: varchar("grade_mode", { length: 20 }).default("standard"), // standard, pass_fail, audit

  // Repeat policy
  isRepeatable: boolean("is_repeatable").default(false),
  maxRepeatCredits: decimal("max_repeat_credits", { precision: 4, scale: 2 }),
  repeatGradePolicy: varchar("repeat_grade_policy", { length: 20 }), // replace, average, highest

  // Schedule type
  scheduleType: varchar("schedule_type", { length: 20 }), // lecture, lab, seminar, independent, online

  // Attributes
  attributes: jsonb("attributes").$type<string[]>(), // honors, writing_intensive, capstone, etc.

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(),
  effectiveStartDate: date("effective_start_date"),
  effectiveEndDate: date("effective_end_date"),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  courseCodeIdx: index("courses_course_code_idx").on(table.courseCode),
  subjectNumberIdx: index("courses_subject_number_idx").on(table.subjectId, table.courseNumber),
}));

// Course Prerequisite/Corequisite
export const courseRequisites = curriculumSchema.table("course_requisites", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),

  requisiteType: varchar("requisite_type", { length: 20 }).notNull(), // prerequisite, corequisite, concurrent

  // Simple requisite (single course)
  requisiteCourseId: uuid("requisite_course_id").references(() => courses.id),
  minimumGrade: varchar("minimum_grade", { length: 5 }),

  // Complex requisite (rule-based)
  requisiteRule: jsonb("requisite_rule").$type<RequisiteRule>(),

  // Text description (for display)
  description: text("description"),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface RequisiteRule {
  operator: "and" | "or";
  conditions: Array<{
    type: "course" | "test" | "standing" | "credits";
    courseId?: string;
    minimumGrade?: string;
    testCode?: string;
    minimumScore?: number;
    minimumStanding?: string;
    minimumCredits?: number;
  }>;
}

// Course Section (offering in a specific term)
export const sections = curriculumSchema.table("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  campusId: uuid("campus_id")
    .references(() => campuses.id),

  // Section identifier
  sectionNumber: varchar("section_number", { length: 10 }).notNull(), // e.g., "001", "A01"
  crn: varchar("crn", { length: 20 }), // Course Reference Number

  // Title override
  titleOverride: varchar("title_override", { length: 200 }),

  // Credits (may differ from master course for variable credit)
  creditHours: decimal("credit_hours", { precision: 4, scale: 2 }).notNull(),
  billingHours: decimal("billing_hours", { precision: 4, scale: 2 }),

  // Capacity
  maxEnrollment: integer("max_enrollment").default(30),
  currentEnrollment: integer("current_enrollment").default(0),
  waitlistMax: integer("waitlist_max").default(0),
  waitlistCurrent: integer("waitlist_current").default(0),

  // Instructor
  primaryInstructorId: uuid("primary_instructor_id").references(() => users.id),

  // Instructional method
  instructionalMethod: varchar("instructional_method", { length: 30 }), // in_person, online, hybrid

  // Section dates (may differ from term)
  startDate: date("start_date"),
  endDate: date("end_date"),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, cancelled, closed

  // Registration restrictions
  restrictionRules: jsonb("restriction_rules").$type<SectionRestrictions>(),

  // Fee
  sectionFee: decimal("section_fee", { precision: 10, scale: 2 }),

  // Attributes
  attributes: jsonb("attributes").$type<string[]>(),

  // Notes
  publicNotes: text("public_notes"), // Visible to students
  internalNotes: text("internal_notes"), // Staff only

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  courseTermIdx: index("sections_course_term_idx").on(table.courseId, table.termId),
  crnIdx: index("sections_crn_idx").on(table.crn),
  instructorIdx: index("sections_instructor_idx").on(table.primaryInstructorId),
  termStatusIdx: index("sections_term_status_idx").on(table.termId, table.status),
}));

export interface SectionRestrictions {
  programs?: string[]; // Allowed programs
  levels?: string[]; // Undergraduate, graduate
  colleges?: string[];
  majors?: string[];
  minimumStanding?: string;
  minimumCredits?: number;
  departmentMajorsOnly?: boolean;
  permissionRequired?: boolean;
}

// Section Instructor (for multiple instructors)
export const sectionInstructors = curriculumSchema.table("section_instructors", {
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  instructorId: uuid("instructor_id")
    .notNull()
    .references(() => users.id),

  role: varchar("role", { length: 30 }).default("instructor"), // instructor, ta, grader
  isPrimary: boolean("is_primary").default(false),
  responsibilityPercentage: integer("responsibility_percentage").default(100),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.sectionId, table.instructorId] }),
}));

// Section Meeting Pattern
export const sectionMeetings = curriculumSchema.table("section_meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),

  // Meeting type
  meetingType: varchar("meeting_type", { length: 20 }), // lecture, lab, discussion

  // Days (stored as array: ["M", "W", "F"])
  daysOfWeek: jsonb("days_of_week").$type<string[]>(),

  // Time
  startTime: time("start_time"),
  endTime: time("end_time"),

  // Location
  roomId: uuid("room_id").references(() => rooms.id),
  locationOverride: varchar("location_override", { length: 100 }), // For off-campus

  // Date range (may be subset of section dates)
  startDate: date("start_date"),
  endDate: date("end_date"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Cross-listed Sections
export const crossListedSections = curriculumSchema.table("cross_listed_sections", {
  primarySectionId: uuid("primary_section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  crossListedSectionId: uuid("cross_listed_section_id")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),

  shareEnrollmentCap: boolean("share_enrollment_cap").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.primarySectionId, table.crossListedSectionId] }),
}));

// Grade Scale
export const gradeScales = curriculumSchema.table("grade_scales", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),

  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Grade Definition
export const grades = curriculumSchema.table("grades", {
  id: uuid("id").primaryKey().defaultRandom(),
  gradeScaleId: uuid("grade_scale_id")
    .notNull()
    .references(() => gradeScales.id, { onDelete: "cascade" }),

  gradeCode: varchar("grade_code", { length: 5 }).notNull(), // A, A-, B+, etc.
  gradePoints: decimal("grade_points", { precision: 4, scale: 3 }), // 4.000, 3.700

  // GPA calculation flags
  countInGpa: boolean("count_in_gpa").default(true),
  earnedCredits: boolean("earned_credits").default(true), // Credits counted as earned
  attemptedCredits: boolean("attempted_credits").default(true), // Credits counted as attempted

  // Special grade types
  isIncomplete: boolean("is_incomplete").default(false),
  isWithdrawal: boolean("is_withdrawal").default(false),
  isPassFail: boolean("is_pass_fail").default(false),
  isAudit: boolean("is_audit").default(false),

  // Display
  displayOrder: integer("display_order").default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const collegesRelations = relations(colleges, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [colleges.institutionId],
    references: [institutions.id],
  }),
  dean: one(users, {
    fields: [colleges.deanId],
    references: [users.id],
  }),
  departments: many(departments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  college: one(colleges, {
    fields: [departments.collegeId],
    references: [colleges.id],
  }),
  chair: one(users, {
    fields: [departments.chairId],
    references: [users.id],
  }),
  subjects: many(subjects),
  programs: many(programs),
  courses: many(courses),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [subjects.institutionId],
    references: [institutions.id],
  }),
  department: one(departments, {
    fields: [subjects.departmentId],
    references: [departments.id],
  }),
  courses: many(courses),
}));

export const programsRelations = relations(programs, ({ one }) => ({
  institution: one(institutions, {
    fields: [programs.institutionId],
    references: [institutions.id],
  }),
  department: one(departments, {
    fields: [programs.departmentId],
    references: [departments.id],
  }),
  degreeType: one(degreeTypes, {
    fields: [programs.degreeTypeId],
    references: [degreeTypes.id],
  }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [courses.institutionId],
    references: [institutions.id],
  }),
  subject: one(subjects, {
    fields: [courses.subjectId],
    references: [subjects.id],
  }),
  department: one(departments, {
    fields: [courses.departmentId],
    references: [departments.id],
  }),
  requisites: many(courseRequisites),
  sections: many(sections),
}));

export const courseRequisitesRelations = relations(courseRequisites, ({ one }) => ({
  course: one(courses, {
    fields: [courseRequisites.courseId],
    references: [courses.id],
  }),
  requisiteCourse: one(courses, {
    fields: [courseRequisites.requisiteCourseId],
    references: [courses.id],
  }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  course: one(courses, {
    fields: [sections.courseId],
    references: [courses.id],
  }),
  term: one(terms, {
    fields: [sections.termId],
    references: [terms.id],
  }),
  campus: one(campuses, {
    fields: [sections.campusId],
    references: [campuses.id],
  }),
  primaryInstructor: one(users, {
    fields: [sections.primaryInstructorId],
    references: [users.id],
  }),
  instructors: many(sectionInstructors),
  meetings: many(sectionMeetings),
}));

export const sectionInstructorsRelations = relations(sectionInstructors, ({ one }) => ({
  section: one(sections, {
    fields: [sectionInstructors.sectionId],
    references: [sections.id],
  }),
  instructor: one(users, {
    fields: [sectionInstructors.instructorId],
    references: [users.id],
  }),
}));

export const sectionMeetingsRelations = relations(sectionMeetings, ({ one }) => ({
  section: one(sections, {
    fields: [sectionMeetings.sectionId],
    references: [sections.id],
  }),
  room: one(rooms, {
    fields: [sectionMeetings.roomId],
    references: [rooms.id],
  }),
}));

export const gradeScalesRelations = relations(gradeScales, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [gradeScales.institutionId],
    references: [institutions.id],
  }),
  grades: many(grades),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  gradeScale: one(gradeScales, {
    fields: [grades.gradeScaleId],
    references: [gradeScales.id],
  }),
}));

// ============================================================================
// PROGRAM REQUIREMENTS (FOR DEGREE AUDIT)
// ============================================================================

// Requirement Category - groups requirements (Core, Major, Gen Ed, Electives)
export const requirementCategories = curriculumSchema.table("requirement_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 30 }).notNull(), // CORE, GEN_ED, MAJOR, ELEC
  name: varchar("name", { length: 100 }).notNull(), // "Core Requirements", "General Education"
  description: text("description"),

  // Display order on degree audit
  displayOrder: integer("display_order").default(0),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionCodeIdx: index("requirement_categories_institution_code_idx").on(table.institutionId, table.code),
}));

// Program Requirements - defines what's needed for a program/catalog year
export const programRequirements = curriculumSchema.table("program_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  catalogYearId: uuid("catalog_year_id")
    .references(() => catalogYears.id),
  categoryId: uuid("category_id")
    .references(() => requirementCategories.id),

  // Requirement details
  name: varchar("name", { length: 200 }).notNull(), // "Computer Science Core"
  description: text("description"),

  // Credit requirements
  minimumCredits: decimal("minimum_credits", { precision: 5, scale: 2 }),
  maximumCredits: decimal("maximum_credits", { precision: 5, scale: 2 }),

  // Course count requirements
  minimumCourses: integer("minimum_courses"),

  // GPA requirement for this category
  minimumGpa: decimal("minimum_gpa", { precision: 4, scale: 3 }),

  // Can courses from this requirement count toward other requirements?
  allowSharing: boolean("allow_sharing").default(false),

  // Display order within the category
  displayOrder: integer("display_order").default(0),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  programCatalogIdx: index("program_requirements_program_catalog_idx").on(table.programId, table.catalogYearId),
  categoryIdx: index("program_requirements_category_idx").on(table.categoryId),
}));

// Requirement Courses - specific courses that satisfy a requirement
export const requirementCourses = curriculumSchema.table("requirement_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id")
    .notNull()
    .references(() => programRequirements.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),

  // Is this a required course vs an elective option?
  isRequired: boolean("is_required").default(true),

  // Minimum grade required
  minimumGrade: varchar("minimum_grade", { length: 5 }),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  requirementCourseIdx: index("requirement_courses_requirement_course_idx").on(table.requirementId, table.courseId),
}));

// Requirement Course Groups - flexible course choices (pick X from list)
export const requirementCourseGroups = curriculumSchema.table("requirement_course_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id")
    .notNull()
    .references(() => programRequirements.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 200 }).notNull(), // "Humanities Elective"
  description: text("description"),

  // How many courses/credits must be selected from this group
  minimumCourses: integer("minimum_courses"),
  minimumCredits: decimal("minimum_credits", { precision: 5, scale: 2 }),

  // Rule-based selection
  selectionRule: jsonb("selection_rule").$type<CourseSelectionRule>(),

  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Interface for course selection rules
export interface CourseSelectionRule {
  type: "course_list" | "subject" | "level" | "attribute";
  // For course_list: specific course IDs
  courseIds?: string[];
  // For subject: courses from specific subjects
  subjectCodes?: string[];
  // For level: minimum course level (e.g., "300" for 300-level+)
  minimumLevel?: string;
  maximumLevel?: string;
  // For attribute: courses with specific attributes
  attributes?: string[];
  // Exclusions
  excludeCourseIds?: string[];
}

// Requirement Course Group Courses - courses in a group
export const requirementCourseGroupCourses = curriculumSchema.table("requirement_course_group_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => requirementCourseGroups.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupCourseIdx: index("requirement_course_group_courses_group_course_idx").on(table.groupId, table.courseId),
}));

// Student Degree Audit - stored audit results
export const studentDegreeAudits = curriculumSchema.table("student_degree_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  studentProgramId: uuid("student_program_id").notNull(),
  programId: uuid("program_id")
    .notNull()
    .references(() => programs.id),
  catalogYearId: uuid("catalog_year_id")
    .references(() => catalogYears.id),

  // Audit timestamp
  auditDate: timestamp("audit_date", { withTimezone: true }).defaultNow().notNull(),

  // Overall progress
  totalCreditsRequired: decimal("total_credits_required", { precision: 5, scale: 2 }),
  totalCreditsEarned: decimal("total_credits_earned", { precision: 5, scale: 2 }),
  totalCreditsInProgress: decimal("total_credits_in_progress", { precision: 5, scale: 2 }),

  // GPA requirements
  overallGpaRequired: decimal("overall_gpa_required", { precision: 4, scale: 3 }),
  overallGpaActual: decimal("overall_gpa_actual", { precision: 4, scale: 3 }),
  majorGpaRequired: decimal("major_gpa_required", { precision: 4, scale: 3 }),
  majorGpaActual: decimal("major_gpa_actual", { precision: 4, scale: 3 }),

  // Completion percentage
  completionPercentage: decimal("completion_percentage", { precision: 5, scale: 2 }),

  // Requirements status
  requirementsStatus: jsonb("requirements_status").$type<RequirementAuditResult[]>(),

  // Courses used (for sharing tracking)
  coursesApplied: jsonb("courses_applied").$type<AppliedCourse[]>(),

  // Audit status
  status: varchar("status", { length: 20 }).default("calculated"), // calculated, reviewed, locked

  // Who ran the audit
  generatedBy: uuid("generated_by"),

  // Notes
  advisorNotes: text("advisor_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentProgramIdx: index("student_degree_audits_student_program_idx").on(table.studentId, table.studentProgramId),
  auditDateIdx: index("student_degree_audits_audit_date_idx").on(table.auditDate),
}));

// Interfaces for degree audit results
export interface RequirementAuditResult {
  requirementId: string;
  requirementName: string;
  categoryName: string;
  status: "complete" | "in_progress" | "incomplete" | "not_started";
  creditsRequired: number;
  creditsEarned: number;
  creditsInProgress: number;
  gpaRequired?: number;
  gpaActual?: number;
  coursesRequired: number;
  coursesCompleted: number;
  coursesInProgress: number;
  appliedCourses: string[]; // course IDs
  missingCourses: string[]; // required course IDs not yet taken
  notes?: string;
}

export interface AppliedCourse {
  courseId: string;
  courseCode: string;
  registrationId?: string;
  transferCreditId?: string;
  testScoreId?: string;
  creditsEarned: number;
  grade?: string;
  gradePoints?: number;
  termId?: string;
  requirementIds: string[]; // which requirements this course satisfies
  status: "completed" | "in_progress" | "transfer" | "test_credit";
}

// ============================================================================
// COURSE SUBSTITUTIONS/WAIVERS
// ============================================================================

/**
 * Course Substitutions - allows a different course to satisfy a requirement
 * Also handles waivers where a requirement is waived entirely
 */
export const courseSubstitutions = curriculumSchema.table("course_substitutions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Student this substitution applies to
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  // The requirement being satisfied
  requirementId: uuid("requirement_id")
    .notNull()
    .references(() => programRequirements.id, { onDelete: "cascade" }),

  // For substitutions: the original required course (optional - some requirements don't specify exact courses)
  originalCourseId: uuid("original_course_id")
    .references(() => courses.id),

  // For substitutions: the course being used as substitute
  // For waivers: this is null
  substituteCourseId: uuid("substitute_course_id")
    .references(() => courses.id),

  // Type of exception
  substitutionType: varchar("substitution_type", { length: 20 }).notNull(), // "substitution" | "waiver"

  // Credits to apply (for waivers or when substitute has different credits)
  creditsApplied: decimal("credits_applied", { precision: 5, scale: 2 }),

  // Approval workflow
  status: varchar("status", { length: 20 }).default("active").notNull(), // "pending" | "active" | "revoked" | "expired"
  approvedBy: uuid("approved_by")
    .references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  // Reason for the substitution/waiver
  reason: text("reason").notNull(),

  // For temporary waivers
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  // Audit trail
  requestedBy: uuid("requested_by")
    .references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  revokedBy: uuid("revoked_by")
    .references(() => users.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentRequirementIdx: index("course_substitutions_student_requirement_idx").on(table.studentId, table.requirementId),
  studentStatusIdx: index("course_substitutions_student_status_idx").on(table.studentId, table.status),
}));

// Requirement Categories Relations
export const requirementCategoriesRelations = relations(requirementCategories, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [requirementCategories.institutionId],
    references: [institutions.id],
  }),
  requirements: many(programRequirements),
}));

// Program Requirements Relations
export const programRequirementsRelations = relations(programRequirements, ({ one, many }) => ({
  program: one(programs, {
    fields: [programRequirements.programId],
    references: [programs.id],
  }),
  catalogYear: one(catalogYears, {
    fields: [programRequirements.catalogYearId],
    references: [catalogYears.id],
  }),
  category: one(requirementCategories, {
    fields: [programRequirements.categoryId],
    references: [requirementCategories.id],
  }),
  courses: many(requirementCourses),
  courseGroups: many(requirementCourseGroups),
}));

// Requirement Courses Relations
export const requirementCoursesRelations = relations(requirementCourses, ({ one }) => ({
  requirement: one(programRequirements, {
    fields: [requirementCourses.requirementId],
    references: [programRequirements.id],
  }),
  course: one(courses, {
    fields: [requirementCourses.courseId],
    references: [courses.id],
  }),
}));

// Requirement Course Groups Relations
export const requirementCourseGroupsRelations = relations(requirementCourseGroups, ({ one, many }) => ({
  requirement: one(programRequirements, {
    fields: [requirementCourseGroups.requirementId],
    references: [programRequirements.id],
  }),
  courses: many(requirementCourseGroupCourses),
}));

// Requirement Course Group Courses Relations
export const requirementCourseGroupCoursesRelations = relations(requirementCourseGroupCourses, ({ one }) => ({
  group: one(requirementCourseGroups, {
    fields: [requirementCourseGroupCourses.groupId],
    references: [requirementCourseGroups.id],
  }),
  course: one(courses, {
    fields: [requirementCourseGroupCourses.courseId],
    references: [courses.id],
  }),
}));

// Student Degree Audits Relations
export const studentDegreeAuditsRelations = relations(studentDegreeAudits, ({ one }) => ({
  program: one(programs, {
    fields: [studentDegreeAudits.programId],
    references: [programs.id],
  }),
  catalogYear: one(catalogYears, {
    fields: [studentDegreeAudits.catalogYearId],
    references: [catalogYears.id],
  }),
}));

// Course Substitutions Relations
export const courseSubstitutionsRelations = relations(courseSubstitutions, ({ one }) => ({
  student: one(students, {
    fields: [courseSubstitutions.studentId],
    references: [students.id],
  }),
  requirement: one(programRequirements, {
    fields: [courseSubstitutions.requirementId],
    references: [programRequirements.id],
  }),
  originalCourse: one(courses, {
    fields: [courseSubstitutions.originalCourseId],
    references: [courses.id],
  }),
  substituteCourse: one(courses, {
    fields: [courseSubstitutions.substituteCourseId],
    references: [courses.id],
  }),
  approver: one(users, {
    fields: [courseSubstitutions.approvedBy],
    references: [users.id],
  }),
  requester: one(users, {
    fields: [courseSubstitutions.requestedBy],
    references: [users.id],
  }),
  revoker: one(users, {
    fields: [courseSubstitutions.revokedBy],
    references: [users.id],
  }),
}));
