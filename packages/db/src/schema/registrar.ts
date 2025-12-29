/**
 * Registrar Schema
 *
 * Database schema for transcript generation, graduation processing,
 * and commencement ceremony management.
 */

import {
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
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions, terms } from "./core.js";
import { users } from "./identity.js";
import { students, studentPrograms } from "./student.js";

// Registrar schema for transcripts, graduation, and diploma management
export const registrarSchema = pgSchema("registrar");

// =============================================================================
// TRANSCRIPT REQUESTS & GENERATION
// =============================================================================

/**
 * Transcript delivery methods
 */
export type TranscriptDeliveryMethod =
  | "electronic_pdf"
  | "electronic_exchange"
  | "mail"
  | "pickup"
  | "third_party";

/**
 * Transcript request types
 */
export type TranscriptType = "official" | "unofficial" | "verification_only";

/**
 * Transcript request status
 */
export type TranscriptRequestStatus =
  | "pending"
  | "processing"
  | "hold_blocked"
  | "completed"
  | "cancelled"
  | "failed";

/**
 * Transcript Request - tracks student transcript orders
 */
export const transcriptRequests = registrarSchema.table("transcript_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Request type
  transcriptType: varchar("transcript_type", { length: 20 })
    .notNull()
    .$type<TranscriptType>(),

  // Delivery method
  deliveryMethod: varchar("delivery_method", { length: 30 })
    .notNull()
    .$type<TranscriptDeliveryMethod>(),

  // Recipient info (for official transcripts)
  recipientName: varchar("recipient_name", { length: 200 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientAddress: jsonb("recipient_address").$type<{
    address1: string;
    address2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  }>(),
  recipientType: varchar("recipient_type", { length: 30 }),
  // self, employer, grad_school, other_institution, licensing_board

  // Request metadata
  purpose: varchar("purpose", { length: 50 }),
  // employment, grad_school, licensing, personal
  copiesRequested: integer("copies_requested").default(1),

  // Hold at conferral option (wait until degree is posted)
  holdForDegree: boolean("hold_for_degree").default(false),
  holdDegreeConferralDate: date("hold_degree_conferral_date"),

  // Processing status
  status: varchar("status", { length: 20 })
    .default("pending")
    .notNull()
    .$type<TranscriptRequestStatus>(),

  // Holds that blocked this request
  blockingHoldIds: jsonb("blocking_hold_ids").$type<string[]>(),

  // Financial
  feeAmount: decimal("fee_amount", { precision: 10, scale: 2 }),
  feePaid: boolean("fee_paid").default(false),
  paymentTransactionId: varchar("payment_transaction_id", { length: 100 }),

  // Requester (may be student or authorized third party)
  requestedBy: uuid("requested_by").references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

  // Processing
  processedBy: uuid("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at", { withTimezone: true }),

  // Delivery
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  trackingNumber: varchar("tracking_number", { length: 100 }),

  // Document reference
  documentStorageKey: varchar("document_storage_key", { length: 500 }),
  documentHash: varchar("document_hash", { length: 64 }), // SHA-256 for verification

  // FERPA compliance - disclosure consent tracking
  disclosureConsent: jsonb("disclosure_consent").$type<{
    method: "signed_form" | "electronic" | "verbal";
    consentDate: string;
    consentDocumentKey?: string;
    consentExpirationDate?: string;
    witnessUserId?: string;
  }>(),

  // Law enforcement / subpoena tracking
  isSubpoena: boolean("is_subpoena").default(false),
  subpoenaDocumentKey: varchar("subpoena_document_key", { length: 500 }),
  studentNotified: boolean("student_notified").default(true),

  // Audit
  auditLogId: varchar("audit_log_id", { length: 100 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("transcript_requests_student_idx").on(table.studentId),
  statusIdx: index("transcript_requests_status_idx").on(table.status),
  requestedAtIdx: index("transcript_requests_requested_at_idx").on(table.requestedAt),
}));

/**
 * Transcript Verifications - public verification of transcript authenticity
 * Used for QR code verification without exposing PII
 */
export const transcriptVerifications = registrarSchema.table("transcript_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Hash of the transcript document (SHA-256)
  documentHash: varchar("document_hash", { length: 64 }).notNull().unique(),

  // Reference to transcript request
  transcriptRequestId: uuid("transcript_request_id")
    .notNull()
    .references(() => transcriptRequests.id),

  // Verification data (NO PII - for public verification page)
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  studentIdLast4: varchar("student_id_last_4", { length: 4 }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  transcriptType: varchar("transcript_type", { length: 20 }).notNull(),

  // Revocation (for corrected transcripts)
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentHashIdx: uniqueIndex("transcript_verifications_hash_idx").on(table.documentHash),
  transcriptRequestIdx: index("transcript_verifications_request_idx").on(table.transcriptRequestId),
  institutionIdx: index("transcript_verifications_institution_idx").on(table.institutionId),
}));

/**
 * Transcript Disclosure Log - FERPA required record of all disclosures
 * Per 34 CFR 99.32, institutions must maintain a record of disclosures
 * for as long as the education record is maintained.
 *
 * Students have the right to inspect this log upon request.
 */
export const transcriptDisclosureLog = registrarSchema.table("transcript_disclosure_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Core references
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }),
  transcriptRequestId: uuid("transcript_request_id")
    .references(() => transcriptRequests.id, { onDelete: "restrict" }),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // REQUIRED: Party receiving disclosure (34 CFR 99.32(a)(1))
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  recipientOrganization: varchar("recipient_organization", { length: 255 }),
  recipientAddress: text("recipient_address"),
  recipientEmail: varchar("recipient_email", { length: 255 }),

  // REQUIRED: Legitimate interest (34 CFR 99.32(a)(2))
  legitimateInterest: text("legitimate_interest").notNull(),

  // Disclosure details
  disclosureDate: timestamp("disclosure_date", { withTimezone: true }).notNull(),
  disclosureMethod: varchar("disclosure_method", { length: 50 }).notNull(),
  // electronic_delivery, mail, in_person, fax, third_party_service

  // Legal basis for disclosure (34 CFR 99.31)
  disclosureBasis: varchar("disclosure_basis", { length: 50 }).notNull(),
  // student_consent, school_official, transfer_enrollment, financial_aid,
  // subpoena, health_safety_emergency, directory_info, judicial_order

  // Consent reference (if applicable)
  consentDocumentKey: varchar("consent_document_key", { length: 500 }),

  // Redisclosure notice included (34 CFR 99.33(a))
  redisclosureNoticeIncluded: boolean("redisclosure_notice_included").default(true),

  // Who processed this disclosure
  processedBy: uuid("processed_by")
    .notNull()
    .references(() => users.id),
  processedByRole: varchar("processed_by_role", { length: 100 }),

  // Audit trail metadata
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 compatible
  userAgent: text("user_agent"),

  // Immutable record - no updates allowed after creation
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  // Hash for integrity verification
  recordHash: varchar("record_hash", { length: 64 }).notNull(),
}, (table) => ({
  // Primary access patterns
  studentIdx: index("disclosure_log_student_idx").on(table.studentId),
  dateIdx: index("disclosure_log_date_idx").on(table.disclosureDate),
  requestIdx: index("disclosure_log_request_idx").on(table.transcriptRequestId),

  // For institutional reporting
  institutionDateIdx: index("disclosure_log_institution_date_idx")
    .on(table.institutionId, table.disclosureDate),

  // For FERPA audits - find disclosures by basis
  basisIdx: index("disclosure_log_basis_idx").on(table.disclosureBasis),
}));

/**
 * Student Name History - tracks name changes for accurate transcripts
 */
export const studentNameHistory = registrarSchema.table("student_name_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),

  // Name type
  nameType: varchar("name_type", { length: 20 }).notNull(),
  // legal, preferred, previous_legal

  firstName: varchar("first_name", { length: 100 }).notNull(),
  middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  suffix: varchar("suffix", { length: 20 }),

  // Effective dates
  effectiveFrom: date("effective_from").notNull(),
  effectiveUntil: date("effective_until"),

  // Documentation
  changeReason: varchar("change_reason", { length: 50 }),
  // marriage, court_order, correction, preferred_name_update
  documentationOnFile: boolean("documentation_on_file").default(false),

  // Who made the change
  changedBy: uuid("changed_by").references(() => users.id),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("student_name_history_student_idx").on(table.studentId),
  effectiveIdx: index("student_name_history_effective_idx").on(table.studentId, table.effectiveFrom),
}));

// =============================================================================
// GRADUATION PROCESSING
// =============================================================================

/**
 * Graduation application status values
 */
export type GraduationApplicationStatus =
  | "submitted"
  | "audit_review"
  | "audit_incomplete"
  | "pending_clearances"
  | "clearances_complete"
  | "approved"
  | "conferred"
  | "diploma_printed"
  | "diploma_shipped"
  | "complete"
  | "denied"
  | "withdrawn";

/**
 * Latin honors designations
 */
export type LatinHonorsDesignation =
  | "summa_cum_laude"
  | "magna_cum_laude"
  | "cum_laude";

/**
 * Graduation Application - tracks degree conferral requests
 */
export const graduationApplications = registrarSchema.table("graduation_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  studentProgramId: uuid("student_program_id")
    .notNull()
    .references(() => studentPrograms.id),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Application details
  applicationDate: timestamp("application_date", { withTimezone: true }).defaultNow().notNull(),
  requestedConferralTermId: uuid("requested_conferral_term_id")
    .notNull()
    .references(() => terms.id),
  requestedConferralDate: date("requested_conferral_date"),

  // Ceremony preference
  ceremonyPreference: varchar("ceremony_preference", { length: 30 }),
  // main_ceremony, departmental, none
  ceremonyId: uuid("ceremony_id"), // FK to commencement_ceremonies

  // Diploma details
  diplomaNameRequested: varchar("diploma_name_requested", { length: 200 }),
  diplomaNameApproved: varchar("diploma_name_approved", { length: 200 }),
  diplomaMailingAddress: jsonb("diploma_mailing_address").$type<{
    address1: string;
    address2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  }>(),

  // Application status tracking
  status: varchar("status", { length: 30 })
    .default("submitted")
    .notNull()
    .$type<GraduationApplicationStatus>(),

  // Degree audit reference
  degreeAuditId: uuid("degree_audit_id"),
  degreeAuditCompletionPct: decimal("degree_audit_completion_pct", { precision: 5, scale: 2 }),

  // Audit review
  auditReviewedBy: uuid("audit_reviewed_by").references(() => users.id),
  auditReviewedAt: timestamp("audit_reviewed_at", { withTimezone: true }),
  auditReviewNotes: text("audit_review_notes"),

  // Clearances (all must be complete before conferral)
  financialClearance: boolean("financial_clearance").default(false),
  financialClearanceDate: timestamp("financial_clearance_date", { withTimezone: true }),
  financialClearanceBy: uuid("financial_clearance_by").references(() => users.id),

  libraryClearance: boolean("library_clearance").default(false),
  libraryClearanceDate: timestamp("library_clearance_date", { withTimezone: true }),

  advisorClearance: boolean("advisor_clearance").default(false),
  advisorClearanceBy: uuid("advisor_clearance_by").references(() => users.id),
  advisorClearanceDate: timestamp("advisor_clearance_date", { withTimezone: true }),

  departmentClearance: boolean("department_clearance").default(false),
  departmentClearanceBy: uuid("department_clearance_by").references(() => users.id),
  departmentClearanceDate: timestamp("department_clearance_date", { withTimezone: true }),

  // Exit counseling (for financial aid recipients)
  exitCounselingRequired: boolean("exit_counseling_required").default(false),
  exitCounselingComplete: boolean("exit_counseling_complete").default(false),
  exitCounselingCompletedDate: date("exit_counseling_completed_date"),

  // Final approval
  registrarApproval: boolean("registrar_approval").default(false),
  registrarApprovalBy: uuid("registrar_approval_by").references(() => users.id),
  registrarApprovalDate: timestamp("registrar_approval_date", { withTimezone: true }),

  // Honors calculation
  finalGpa: decimal("final_gpa", { precision: 4, scale: 3 }),
  honorsDesignation: varchar("honors_designation", { length: 30 }).$type<LatinHonorsDesignation>(),
  honorsCalculatedAt: timestamp("honors_calculated_at", { withTimezone: true }),

  // Conferral
  actualConferralDate: date("actual_conferral_date"),
  conferredBy: uuid("conferred_by").references(() => users.id),
  conferredAt: timestamp("conferred_at", { withTimezone: true }),

  // Diploma
  diplomaNumber: varchar("diploma_number", { length: 50 }),
  diplomaPrintedDate: date("diploma_printed_date"),
  diplomaShippedDate: date("diploma_shipped_date"),
  diplomaTrackingNumber: varchar("diploma_tracking_number", { length: 100 }),

  // NSC Reporting
  nscReportedAt: timestamp("nsc_reported_at", { withTimezone: true }),
  nscReportBatchId: varchar("nsc_report_batch_id", { length: 100 }),

  // Fees
  applicationFee: decimal("application_fee", { precision: 10, scale: 2 }),
  applicationFeePaid: boolean("application_fee_paid").default(false),

  // Denial/withdrawal
  denialReason: text("denial_reason"),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  withdrawnReason: text("withdrawn_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("graduation_applications_student_idx").on(table.studentId),
  studentProgramIdx: index("graduation_applications_student_program_idx").on(table.studentProgramId),
  statusIdx: index("graduation_applications_status_idx").on(table.status),
  termIdx: index("graduation_applications_term_idx").on(table.requestedConferralTermId),
  conferralDateIdx: index("graduation_applications_conferral_date_idx").on(table.actualConferralDate),
}));

// =============================================================================
// COMMENCEMENT CEREMONIES
// =============================================================================

/**
 * Commencement Ceremony - ceremony event configuration
 */
export const commencementCeremonies = registrarSchema.table("commencement_ceremonies", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  name: varchar("name", { length: 200 }).notNull(),
  ceremonyType: varchar("ceremony_type", { length: 30 }),
  // main, college, department

  // Schedule
  ceremonyDate: date("ceremony_date").notNull(),
  ceremonyTime: time("ceremony_time"),
  locationName: varchar("location_name", { length: 200 }),
  locationAddress: text("location_address"),

  // Capacity
  maxParticipants: integer("max_participants"),
  currentParticipants: integer("current_participants").default(0),
  guestTicketsPerStudent: integer("guest_tickets_per_student").default(4),

  // RSVP dates
  rsvpOpenDate: date("rsvp_open_date"),
  rsvpDeadlineDate: date("rsvp_deadline_date"),

  // Regalia info
  regaliaVendor: varchar("regalia_vendor", { length: 200 }),
  regaliaOrderDeadline: date("regalia_order_deadline"),

  // Program deadlines
  programNameDeadline: date("program_name_deadline"),

  // Conferral (official degree date may differ from ceremony)
  conferralDate: date("conferral_date"),

  // Status
  status: varchar("status", { length: 20 }).default("scheduled"),
  // scheduled, rsvp_open, rsvp_closed, completed, cancelled

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionTermIdx: index("commencement_ceremonies_institution_term_idx").on(table.institutionId, table.termId),
  dateIdx: index("commencement_ceremonies_date_idx").on(table.ceremonyDate),
}));

/**
 * Ceremony Participant - student participation in ceremony
 */
export const ceremonyParticipants = registrarSchema.table("ceremony_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ceremonyId: uuid("ceremony_id")
    .notNull()
    .references(() => commencementCeremonies.id, { onDelete: "cascade" }),
  graduationApplicationId: uuid("graduation_application_id")
    .notNull()
    .references(() => graduationApplications.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  // Participation status
  status: varchar("status", { length: 20 }).default("registered"),
  // registered, confirmed, declined, attended, no_show

  // Name for program (may differ from diploma name)
  programName: varchar("program_name", { length: 200 }),

  // Guest info
  guestTicketsRequested: integer("guest_tickets_requested").default(0),
  guestTicketsApproved: integer("guest_tickets_approved"),

  // Seating/lineup
  lineupPosition: integer("lineup_position"),
  sectionAssignment: varchar("section_assignment", { length: 50 }),

  // Special needs
  accessibilityNeeds: text("accessibility_needs"),

  // Regalia
  regaliaOrderPlaced: boolean("regalia_order_placed").default(false),

  // Check-in
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedInBy: uuid("checked_in_by").references(() => users.id),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ceremonyIdx: index("ceremony_participants_ceremony_idx").on(table.ceremonyId),
  studentIdx: index("ceremony_participants_student_idx").on(table.studentId),
  graduationAppIdx: uniqueIndex("ceremony_participants_graduation_app_idx").on(table.graduationApplicationId),
}));

// =============================================================================
// NSC DEGREE REPORTING
// =============================================================================

/**
 * NSC Degree Report - batch degree reporting to National Student Clearinghouse
 */
export const nscDegreeReports = registrarSchema.table("nsc_degree_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  reportPeriod: varchar("report_period", { length: 20 }).notNull(), // e.g., "2025-05"
  reportType: varchar("report_type", { length: 20 }).notNull(), // enrollment, degree

  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  generatedBy: uuid("generated_by").references(() => users.id),

  recordCount: integer("record_count"),
  fileName: varchar("file_name", { length: 200 }),
  fileStorageKey: varchar("file_storage_key", { length: 500 }),

  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submissionConfirmation: varchar("submission_confirmation", { length: 100 }),

  status: varchar("status", { length: 20 }).default("generated"),
  // generated, submitted, accepted, rejected, errors

  errorDetails: text("error_details"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionIdx: index("nsc_degree_reports_institution_idx").on(table.institutionId),
  periodIdx: index("nsc_degree_reports_period_idx").on(table.reportPeriod),
  statusIdx: index("nsc_degree_reports_status_idx").on(table.status),
}));

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Batch Conferral Job - tracks batch graduation processing
 */
export const batchConferralJobs = registrarSchema.table("batch_conferral_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),
  ceremonyId: uuid("ceremony_id").references(() => commencementCeremonies.id),

  // Configuration
  conferralDate: date("conferral_date").notNull(),
  config: jsonb("config").$type<BatchConferralConfig>(),

  // Results
  totalEligible: integer("total_eligible").default(0),
  totalConferred: integer("total_conferred").default(0),
  totalFailed: integer("total_failed").default(0),
  totalSkipped: integer("total_skipped").default(0),

  // Detailed results
  results: jsonb("results").$type<BatchConferralResultEntry[]>(),

  // Status
  status: varchar("status", { length: 20 }).default("pending"),
  // pending, processing, completed, failed

  // Execution
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  startedBy: uuid("started_by").references(() => users.id),

  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionTermIdx: index("batch_conferral_jobs_institution_term_idx").on(table.institutionId, table.termId),
  statusIdx: index("batch_conferral_jobs_status_idx").on(table.status),
}));

/**
 * Batch Transcript Job - tracks batch transcript generation
 */
export const batchTranscriptJobs = registrarSchema.table("batch_transcript_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Configuration
  config: jsonb("config").$type<BatchTranscriptConfig>(),

  // Results
  totalRequested: integer("total_requested").default(0),
  totalGenerated: integer("total_generated").default(0),
  totalFailed: integer("total_failed").default(0),
  totalBlockedByHolds: integer("total_blocked_by_holds").default(0),

  // Status
  status: varchar("status", { length: 20 }).default("pending"),
  // pending, processing, completed, failed

  // Execution
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  startedBy: uuid("started_by").references(() => users.id),

  // Output
  outputStorageKey: varchar("output_storage_key", { length: 500 }),

  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionIdx: index("batch_transcript_jobs_institution_idx").on(table.institutionId),
  statusIdx: index("batch_transcript_jobs_status_idx").on(table.status),
}));

// =============================================================================
// INTERFACES FOR JSONB FIELDS
// =============================================================================

export interface BatchConferralConfig {
  programIds?: string[];
  degreeTypeIds?: string[];
  includeStatuses: GraduationApplicationStatus[];
  validateBeforeConferral: boolean;
  skipValidationFailures: boolean;
  updateStudentStatus: boolean;
  updateProgramStatus: boolean;
  generateTranscripts: boolean;
  reportToNSC: boolean;
  notifyStudents: boolean;
  calculateLatinHonors: boolean;
  latinHonorsThresholds?: {
    summa: number;
    magna: number;
    cum: number;
  };
}

export interface BatchConferralResultEntry {
  studentId: string;
  studentProgramId: string;
  graduationApplicationId: string;
  status: "conferred" | "failed" | "skipped";
  degreeAwarded?: string;
  honorsDesignation?: string;
  failureReason?: string;
  blockers?: string[];
}

export interface BatchTranscriptConfig {
  conferralTermId?: string;
  conferralDateRange?: { start: string; end: string };
  programIds?: string[];
  studentIds?: string[];
  transcriptType: TranscriptType;
  includeInProgressFinalTerm: boolean;
  deliveryMethod: TranscriptDeliveryMethod;
  skipStudentsWithHolds: boolean;
  notifyStudents: boolean;
}

// =============================================================================
// RELATIONS
// =============================================================================

export const transcriptRequestsRelations = relations(transcriptRequests, ({ one, many }) => ({
  student: one(students, {
    fields: [transcriptRequests.studentId],
    references: [students.id],
  }),
  institution: one(institutions, {
    fields: [transcriptRequests.institutionId],
    references: [institutions.id],
  }),
  requestedByUser: one(users, {
    fields: [transcriptRequests.requestedBy],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [transcriptRequests.processedBy],
    references: [users.id],
  }),
  verification: one(transcriptVerifications, {
    fields: [transcriptRequests.id],
    references: [transcriptVerifications.transcriptRequestId],
  }),
}));

export const transcriptVerificationsRelations = relations(transcriptVerifications, ({ one }) => ({
  transcriptRequest: one(transcriptRequests, {
    fields: [transcriptVerifications.transcriptRequestId],
    references: [transcriptRequests.id],
  }),
  institution: one(institutions, {
    fields: [transcriptVerifications.institutionId],
    references: [institutions.id],
  }),
}));

export const transcriptDisclosureLogRelations = relations(transcriptDisclosureLog, ({ one }) => ({
  student: one(students, {
    fields: [transcriptDisclosureLog.studentId],
    references: [students.id],
  }),
  transcriptRequest: one(transcriptRequests, {
    fields: [transcriptDisclosureLog.transcriptRequestId],
    references: [transcriptRequests.id],
  }),
  institution: one(institutions, {
    fields: [transcriptDisclosureLog.institutionId],
    references: [institutions.id],
  }),
  processor: one(users, {
    fields: [transcriptDisclosureLog.processedBy],
    references: [users.id],
  }),
}));

export const studentNameHistoryRelations = relations(studentNameHistory, ({ one }) => ({
  student: one(students, {
    fields: [studentNameHistory.studentId],
    references: [students.id],
  }),
  changedByUser: one(users, {
    fields: [studentNameHistory.changedBy],
    references: [users.id],
  }),
}));

export const graduationApplicationsRelations = relations(graduationApplications, ({ one, many }) => ({
  student: one(students, {
    fields: [graduationApplications.studentId],
    references: [students.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [graduationApplications.studentProgramId],
    references: [studentPrograms.id],
  }),
  institution: one(institutions, {
    fields: [graduationApplications.institutionId],
    references: [institutions.id],
  }),
  requestedConferralTerm: one(terms, {
    fields: [graduationApplications.requestedConferralTermId],
    references: [terms.id],
  }),
  ceremony: one(commencementCeremonies, {
    fields: [graduationApplications.ceremonyId],
    references: [commencementCeremonies.id],
  }),
  auditReviewedByUser: one(users, {
    fields: [graduationApplications.auditReviewedBy],
    references: [users.id],
  }),
  financialClearanceByUser: one(users, {
    fields: [graduationApplications.financialClearanceBy],
    references: [users.id],
  }),
  advisorClearanceByUser: one(users, {
    fields: [graduationApplications.advisorClearanceBy],
    references: [users.id],
  }),
  departmentClearanceByUser: one(users, {
    fields: [graduationApplications.departmentClearanceBy],
    references: [users.id],
  }),
  registrarApprovalByUser: one(users, {
    fields: [graduationApplications.registrarApprovalBy],
    references: [users.id],
  }),
  conferredByUser: one(users, {
    fields: [graduationApplications.conferredBy],
    references: [users.id],
  }),
  ceremonyParticipation: many(ceremonyParticipants),
}));

export const commencementCeremoniesRelations = relations(commencementCeremonies, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [commencementCeremonies.institutionId],
    references: [institutions.id],
  }),
  term: one(terms, {
    fields: [commencementCeremonies.termId],
    references: [terms.id],
  }),
  participants: many(ceremonyParticipants),
  batchConferralJobs: many(batchConferralJobs),
}));

export const ceremonyParticipantsRelations = relations(ceremonyParticipants, ({ one }) => ({
  ceremony: one(commencementCeremonies, {
    fields: [ceremonyParticipants.ceremonyId],
    references: [commencementCeremonies.id],
  }),
  graduationApplication: one(graduationApplications, {
    fields: [ceremonyParticipants.graduationApplicationId],
    references: [graduationApplications.id],
  }),
  student: one(students, {
    fields: [ceremonyParticipants.studentId],
    references: [students.id],
  }),
  checkedInByUser: one(users, {
    fields: [ceremonyParticipants.checkedInBy],
    references: [users.id],
  }),
}));

export const nscDegreeReportsRelations = relations(nscDegreeReports, ({ one }) => ({
  institution: one(institutions, {
    fields: [nscDegreeReports.institutionId],
    references: [institutions.id],
  }),
  generatedByUser: one(users, {
    fields: [nscDegreeReports.generatedBy],
    references: [users.id],
  }),
}));

export const batchConferralJobsRelations = relations(batchConferralJobs, ({ one }) => ({
  institution: one(institutions, {
    fields: [batchConferralJobs.institutionId],
    references: [institutions.id],
  }),
  term: one(terms, {
    fields: [batchConferralJobs.termId],
    references: [terms.id],
  }),
  ceremony: one(commencementCeremonies, {
    fields: [batchConferralJobs.ceremonyId],
    references: [commencementCeremonies.id],
  }),
  startedByUser: one(users, {
    fields: [batchConferralJobs.startedBy],
    references: [users.id],
  }),
}));

export const batchTranscriptJobsRelations = relations(batchTranscriptJobs, ({ one }) => ({
  institution: one(institutions, {
    fields: [batchTranscriptJobs.institutionId],
    references: [institutions.id],
  }),
  startedByUser: one(users, {
    fields: [batchTranscriptJobs.startedBy],
    references: [users.id],
  }),
}));
