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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Core schema for institutional configuration
export const coreSchema = pgSchema("core");

// Institution - root entity for multi-tenant support
export const institutions = coreSchema.table("institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  shortName: varchar("short_name", { length: 50 }),

  // OPEID for federal reporting (Office of Postsecondary Education ID)
  opeid: varchar("opeid", { length: 8 }),
  // IPEDS Unit ID
  ipedsId: varchar("ipeds_id", { length: 6 }),
  // FICE code (Federal Interagency Committee on Education)
  ficeCode: varchar("fice_code", { length: 6 }),

  // Address
  address1: varchar("address_1", { length: 100 }),
  address2: varchar("address_2", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  postalCode: varchar("postal_code", { length: 10 }),
  country: varchar("country", { length: 2 }).default("US"),

  // Contact
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 200 }),

  // Accreditation
  accreditingBody: varchar("accrediting_body", { length: 100 }),
  accreditationStatus: varchar("accreditation_status", { length: 50 }),

  // Settings
  settings: jsonb("settings").$type<InstitutionSettings>(),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface InstitutionSettings {
  timezone: string;
  locale: string;
  dateFormat: string;
  academicYearStart: string; // e.g., "08-01" for August 1
  gradeScale: "4.0" | "5.0" | "100";
}

// Campus - physical locations
export const campuses = coreSchema.table("campuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),

  // Address
  address1: varchar("address_1", { length: 100 }),
  address2: varchar("address_2", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  postalCode: varchar("postal_code", { length: 10 }),
  country: varchar("country", { length: 2 }).default("US"),

  // For branch campus reporting
  isMainCampus: boolean("is_main_campus").default(false),
  branchId: varchar("branch_id", { length: 10 }), // OPEID branch

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Academic Year
export const academicYears = coreSchema.table("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  code: varchar("code", { length: 20 }).notNull(), // e.g., "2024-2025"
  name: varchar("name", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  // Financial aid award year (may differ from academic year)
  aidYearCode: varchar("aid_year_code", { length: 10 }), // e.g., "2425"

  isCurrent: boolean("is_current").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Term/Semester
export const terms = coreSchema.table("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  academicYearId: uuid("academic_year_id")
    .references(() => academicYears.id),

  code: varchar("code", { length: 20 }).notNull(), // e.g., "FA24", "SP25"
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Fall 2024"
  shortName: varchar("short_name", { length: 20 }), // e.g., "Fall 24"

  // Term type for reporting
  termType: varchar("term_type", { length: 20 }).notNull(), // fall, spring, summer, winter, quarter

  // Key dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  censusDate: date("census_date"), // Official enrollment count date

  // Registration dates
  registrationStartDate: date("registration_start_date"),
  registrationEndDate: date("registration_end_date"),
  addDeadline: date("add_deadline"),
  dropDeadline: date("drop_deadline"),
  withdrawalDeadline: date("withdrawal_deadline"),

  // Grading dates
  midtermGradesDue: date("midterm_grades_due"),
  finalGradesDue: date("final_grades_due"),

  // Financial dates
  tuitionDueDate: date("tuition_due_date"),
  refundDeadline100: date("refund_deadline_100"), // 100% refund
  refundDeadline75: date("refund_deadline_75"),
  refundDeadline50: date("refund_deadline_50"),
  refundDeadline25: date("refund_deadline_25"),

  // Aid dates
  aidDisbursementDate: date("aid_disbursement_date"),

  // Status
  isCurrent: boolean("is_current").default(false),
  isVisible: boolean("is_visible").default(true), // Show in student portal
  allowRegistration: boolean("allow_registration").default(false),

  // For sorting/ordering
  sortOrder: integer("sort_order").default(0),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Term Sessions (Part-of-Term) - for accelerated terms, 8-week sessions, etc.
export const termSessions = coreSchema.table("term_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  code: varchar("code", { length: 20 }).notNull(), // e.g., "FULL", "1ST8", "2ND8"
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Full Term", "First 8-Week"

  // Session dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  censusDate: date("census_date"),

  // Registration/add-drop dates (override term-level if set)
  addDeadline: date("add_deadline"),
  dropDeadline: date("drop_deadline"),
  withdrawalDeadline: date("withdrawal_deadline"),

  // Refund dates for this session
  refundDeadline100: date("refund_deadline_100"),
  refundDeadline75: date("refund_deadline_75"),
  refundDeadline50: date("refund_deadline_50"),
  refundDeadline25: date("refund_deadline_25"),

  // Aid disbursement for this session
  aidDisbursementDate: date("aid_disbursement_date"),

  // Is this the default/full-term session?
  isDefault: boolean("is_default").default(false),

  // For sorting/ordering
  sortOrder: integer("sort_order").default(0),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Academic Calendar Events
export const calendarEvents = coreSchema.table("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  termId: uuid("term_id").references(() => terms.id),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  eventType: varchar("event_type", { length: 50 }).notNull(), // holiday, deadline, event

  startDate: date("start_date").notNull(),
  endDate: date("end_date"),

  // Affects operations
  campusClosed: boolean("campus_closed").default(false),
  classesHeld: boolean("classes_held").default(true),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Building/Location (for room scheduling)
export const buildings = coreSchema.table("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  campusId: uuid("campus_id")
    .notNull()
    .references(() => campuses.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),

  address: varchar("address", { length: 200 }),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Room
export const rooms = coreSchema.table("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  buildingId: uuid("building_id")
    .notNull()
    .references(() => buildings.id),

  roomNumber: varchar("room_number", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }),

  roomType: varchar("room_type", { length: 50 }), // classroom, lab, lecture_hall, office
  capacity: integer("capacity"),

  // Features
  features: jsonb("features").$type<string[]>(), // projector, whiteboard, computers, etc.

  isSchedulable: boolean("is_schedulable").default(true),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const institutionsRelations = relations(institutions, ({ many }) => ({
  campuses: many(campuses),
  academicYears: many(academicYears),
  terms: many(terms),
  calendarEvents: many(calendarEvents),
}));

export const campusesRelations = relations(campuses, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [campuses.institutionId],
    references: [institutions.id],
  }),
  buildings: many(buildings),
}));

export const academicYearsRelations = relations(academicYears, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [academicYears.institutionId],
    references: [institutions.id],
  }),
  terms: many(terms),
}));

export const termsRelations = relations(terms, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [terms.institutionId],
    references: [institutions.id],
  }),
  academicYear: one(academicYears, {
    fields: [terms.academicYearId],
    references: [academicYears.id],
  }),
  sessions: many(termSessions),
  calendarEvents: many(calendarEvents),
}));

export const termSessionsRelations = relations(termSessions, ({ one }) => ({
  institution: one(institutions, {
    fields: [termSessions.institutionId],
    references: [institutions.id],
  }),
  term: one(terms, {
    fields: [termSessions.termId],
    references: [terms.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  institution: one(institutions, {
    fields: [calendarEvents.institutionId],
    references: [institutions.id],
  }),
  term: one(terms, {
    fields: [calendarEvents.termId],
    references: [terms.id],
  }),
}));

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  campus: one(campuses, {
    fields: [buildings.campusId],
    references: [campuses.id],
  }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one }) => ({
  building: one(buildings, {
    fields: [rooms.buildingId],
    references: [buildings.id],
  }),
}));
