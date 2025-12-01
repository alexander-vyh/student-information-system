import {
  pgTable,
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  date,
  timestamp,
  smallint,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions, academicYears, terms } from "./core.js";
import { users } from "./identity.js";
import { students, studentPrograms } from "./student.js";
import { ledgerEntries } from "./financial.js";

// Financial Aid schema
export const aidSchema = pgSchema("aid");

// Award Year Configuration
export const awardYears = aidSchema.table("award_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 10 }).notNull(), // e.g., "2425" for 2024-2025
  name: varchar("name", { length: 100 }).notNull(),

  // Dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  // ISIR processing
  isirFilePrefix: varchar("isir_file_prefix", { length: 20 }),

  // Federal limits for the year
  pellMaximum: decimal("pell_maximum", { precision: 10, scale: 2 }),
  subsidizedLoanLimitFreshman: decimal("subsidized_loan_limit_freshman", { precision: 10, scale: 2 }),
  subsidizedLoanLimitSophomore: decimal("subsidized_loan_limit_sophomore", { precision: 10, scale: 2 }),
  subsidizedLoanLimitJuniorSenior: decimal("subsidized_loan_limit_junior_senior", { precision: 10, scale: 2 }),
  unsubsidizedLoanLimit: decimal("unsubsidized_loan_limit", { precision: 10, scale: 2 }),

  // Status
  isCurrent: boolean("is_current").default(false),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Fund Type (Pell, SEOG, Loans, Institutional, etc.)
export const fundTypes = aidSchema.table("fund_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .references(() => institutions.id), // null = federal fund

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),

  // Fund category
  category: varchar("category", { length: 30 }).notNull(), // grant, scholarship, loan, work_study
  source: varchar("source", { length: 30 }).notNull(), // federal, state, institutional, external

  // For federal reporting
  federalFundCode: varchar("federal_fund_code", { length: 10 }),

  // Characteristics
  needBased: boolean("need_based").default(false),
  meritBased: boolean("merit_based").default(false),
  requiresRepayment: boolean("requires_repayment").default(false),

  // 1098-T treatment
  reportOn1098t: boolean("report_on_1098t").default(true),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Fund (specific fund instance)
export const funds = aidSchema.table("funds", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  fundTypeId: uuid("fund_type_id")
    .notNull()
    .references(() => fundTypes.id),
  awardYearId: uuid("award_year_id")
    .references(() => awardYears.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Budget
  totalBudget: decimal("total_budget", { precision: 14, scale: 2 }),
  awardedAmount: decimal("awarded_amount", { precision: 14, scale: 2 }).default("0"),
  disbursedAmount: decimal("disbursed_amount", { precision: 14, scale: 2 }).default("0"),

  // Award limits
  minimumAward: decimal("minimum_award", { precision: 10, scale: 2 }),
  maximumAward: decimal("maximum_award", { precision: 10, scale: 2 }),

  // Eligibility criteria (simplified - complex rules in separate table)
  requiresFafsa: boolean("requires_fafsa").default(true),
  minimumGpa: decimal("minimum_gpa", { precision: 4, scale: 3 }),
  minimumCredits: decimal("minimum_credits", { precision: 4, scale: 2 }),

  // Priority deadline
  priorityDeadline: date("priority_deadline"),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Student ISIR (Institutional Student Information Record from FAFSA)
export const isirRecords = aidSchema.table("isir_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  awardYearId: uuid("award_year_id")
    .notNull()
    .references(() => awardYears.id),

  // ISIR identification
  transactionNumber: smallint("transaction_number").notNull(),
  isirReceivedDate: date("isir_received_date").notNull(),

  // EFC/SAI (Student Aid Index)
  efc: decimal("efc", { precision: 10, scale: 2 }), // Expected Family Contribution (legacy)
  sai: decimal("sai", { precision: 10, scale: 2 }), // Student Aid Index (new)

  // Pell eligibility
  pellEligible: boolean("pell_eligible").default(false),
  pellLifetimeEligibilityUsed: decimal("pell_lifetime_eligibility_used", { precision: 6, scale: 4 }), // e.g., 4.5000

  // Dependency status
  dependencyStatus: varchar("dependency_status", { length: 20 }), // dependent, independent

  // Verification
  verificationSelected: boolean("verification_selected").default(false),
  verificationTrackingGroup: varchar("verification_tracking_group", { length: 10 }),
  verificationCompleted: boolean("verification_completed").default(false),
  verificationCompletedDate: date("verification_completed_date"),

  // C-flags and comments
  cFlagCodes: jsonb("c_flag_codes").$type<string[]>(),
  commentCodes: jsonb("comment_codes").$type<string[]>(),

  // Key ISIR data points (denormalized for common access)
  studentAgi: decimal("student_agi", { precision: 12, scale: 2 }),
  parentAgi: decimal("parent_agi", { precision: 12, scale: 2 }),
  householdSize: smallint("household_size"),
  numberInCollege: smallint("number_in_college"),

  // Citizenship
  citizenshipStatus: varchar("citizenship_status", { length: 20 }),

  // Full ISIR data (stored as JSON for complete record)
  isirData: jsonb("isir_data").$type<Record<string, unknown>>(),

  // Status
  isActive: boolean("is_active").default(true), // false when superseded by newer transaction
  status: varchar("status", { length: 20 }).default("received").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentYearIdx: index("isir_records_student_year_idx").on(table.studentId, table.awardYearId),
  transactionIdx: uniqueIndex("isir_records_transaction_idx").on(table.studentId, table.awardYearId, table.transactionNumber),
}));

// Student Aid Application (budget/COA)
export const aidApplications = aidSchema.table("aid_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  awardYearId: uuid("award_year_id")
    .notNull()
    .references(() => awardYears.id),
  studentProgramId: uuid("student_program_id")
    .references(() => studentPrograms.id),

  // Current ISIR
  activeIsirId: uuid("active_isir_id").references(() => isirRecords.id),

  // Enrollment assumptions
  enrollmentStatus: varchar("enrollment_status", { length: 20 }), // full_time, three_quarter, half_time, less_than_half
  housingStatus: varchar("housing_status", { length: 20 }), // on_campus, off_campus, with_parent

  // Cost of Attendance (Budget)
  coaTuition: decimal("coa_tuition", { precision: 10, scale: 2 }),
  coaFees: decimal("coa_fees", { precision: 10, scale: 2 }),
  coaBooks: decimal("coa_books", { precision: 10, scale: 2 }),
  coaRoomBoard: decimal("coa_room_board", { precision: 10, scale: 2 }),
  coaTransportation: decimal("coa_transportation", { precision: 10, scale: 2 }),
  coaPersonal: decimal("coa_personal", { precision: 10, scale: 2 }),
  coaOther: decimal("coa_other", { precision: 10, scale: 2 }),
  coaTotal: decimal("coa_total", { precision: 10, scale: 2 }),

  // Need calculation
  efc: decimal("efc", { precision: 10, scale: 2 }),
  demonstratedNeed: decimal("demonstrated_need", { precision: 10, scale: 2 }),

  // Award totals
  totalAidOffered: decimal("total_aid_offered", { precision: 10, scale: 2 }).default("0"),
  totalAidAccepted: decimal("total_aid_accepted", { precision: 10, scale: 2 }).default("0"),
  totalAidDisbursed: decimal("total_aid_disbursed", { precision: 10, scale: 2 }).default("0"),

  // Remaining need/eligibility
  remainingNeed: decimal("remaining_need", { precision: 10, scale: 2 }),
  remainingCoa: decimal("remaining_coa", { precision: 10, scale: 2 }),

  // Status
  status: varchar("status", { length: 20 }).default("in_progress").notNull(),
  // in_progress, packaged, awarded, accepted, cancelled

  // Award letter
  awardLetterGeneratedAt: timestamp("award_letter_generated_at", { withTimezone: true }),
  awardLetterAcceptedAt: timestamp("award_letter_accepted_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentYearIdx: uniqueIndex("aid_applications_student_year_idx").on(table.studentId, table.awardYearId),
}));

// Aid Award
export const aidAwards = aidSchema.table("aid_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  aidApplicationId: uuid("aid_application_id")
    .notNull()
    .references(() => aidApplications.id),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),

  // Award amounts
  offeredAmount: decimal("offered_amount", { precision: 10, scale: 2 }).notNull(),
  acceptedAmount: decimal("accepted_amount", { precision: 10, scale: 2 }),
  declinedAmount: decimal("declined_amount", { precision: 10, scale: 2 }),
  cancelledAmount: decimal("cancelled_amount", { precision: 10, scale: 2 }),
  disbursedAmount: decimal("disbursed_amount", { precision: 10, scale: 2 }).default("0"),

  // Status
  status: varchar("status", { length: 20 }).default("offered").notNull(),
  // offered, accepted, partially_accepted, declined, cancelled, completed

  // For loans
  loanPeriodStart: date("loan_period_start"),
  loanPeriodEnd: date("loan_period_end"),
  loanFee: decimal("loan_fee", { precision: 10, scale: 2 }),
  loanInterestRate: decimal("loan_interest_rate", { precision: 5, scale: 4 }),

  // MPN and entrance counseling (for loans)
  mpnCompleted: boolean("mpn_completed"),
  entranceCounselingCompleted: boolean("entrance_counseling_completed"),

  // Awarding details
  awardedBy: uuid("awarded_by").references(() => users.id),
  awardedAt: timestamp("awarded_at", { withTimezone: true }),

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  applicationIdx: index("aid_awards_application_idx").on(table.aidApplicationId),
  fundIdx: index("aid_awards_fund_idx").on(table.fundId),
  statusIdx: index("aid_awards_status_idx").on(table.status),
}));

// Award Disbursement Schedule
export const disbursementSchedules = aidSchema.table("disbursement_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  aidAwardId: uuid("aid_award_id")
    .notNull()
    .references(() => aidAwards.id, { onDelete: "cascade" }),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  // Scheduled amount
  scheduledAmount: decimal("scheduled_amount", { precision: 10, scale: 2 }).notNull(),
  scheduledDate: date("scheduled_date"),

  // Actual disbursement
  disbursedAmount: decimal("disbursed_amount", { precision: 10, scale: 2 }),
  disbursedDate: date("disbursed_date"),
  ledgerEntryId: uuid("ledger_entry_id").references(() => ledgerEntries.id),

  // Status
  status: varchar("status", { length: 20 }).default("scheduled").notNull(),
  // scheduled, ready, disbursed, cancelled, returned

  // Hold reasons
  holdReason: varchar("hold_reason", { length: 100 }),
  holdUntil: date("hold_until"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  awardTermIdx: index("disbursement_schedules_award_term_idx").on(table.aidAwardId, table.termId),
}));

// Satisfactory Academic Progress (SAP)
export const sapRecords = aidSchema.table("sap_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  awardYearId: uuid("award_year_id")
    .notNull()
    .references(() => awardYears.id),
  termId: uuid("term_id")
    .references(() => terms.id),

  // Evaluation point
  evaluationDate: date("evaluation_date").notNull(),
  evaluationType: varchar("evaluation_type", { length: 20 }), // end_of_term, annual, appeal

  // Academic metrics at time of evaluation
  cumulativeAttemptedCredits: decimal("cumulative_attempted_credits", { precision: 8, scale: 2 }),
  cumulativeEarnedCredits: decimal("cumulative_earned_credits", { precision: 8, scale: 2 }),
  cumulativeGpa: decimal("cumulative_gpa", { precision: 4, scale: 3 }),

  // SAP component results
  gpaRequirementMet: boolean("gpa_requirement_met"),
  minimumGpaRequired: decimal("minimum_gpa_required", { precision: 4, scale: 3 }),

  paceRequirementMet: boolean("pace_requirement_met"),
  pacePercentage: decimal("pace_percentage", { precision: 5, scale: 2 }),
  minimumPaceRequired: decimal("minimum_pace_required", { precision: 5, scale: 2 }),

  maxTimeframeExceeded: boolean("max_timeframe_exceeded"),
  creditsTowardMaxTimeframe: decimal("credits_toward_max_timeframe", { precision: 8, scale: 2 }),
  maxTimeframeCredits: decimal("max_timeframe_credits", { precision: 8, scale: 2 }),

  // Overall status
  sapStatus: varchar("sap_status", { length: 30 }).notNull(),
  // satisfactory, warning, probation, suspension, academic_plan

  // Previous status (for tracking progression)
  previousSapStatus: varchar("previous_sap_status", { length: 30 }),

  // Eligibility
  eligibleForAid: boolean("eligible_for_aid").default(true),

  // Appeal
  appealSubmitted: boolean("appeal_submitted").default(false),
  appealDate: date("appeal_date"),
  appealReason: text("appeal_reason"),
  appealDecision: varchar("appeal_decision", { length: 20 }), // approved, denied, pending
  appealDecisionDate: date("appeal_decision_date"),
  appealDecisionBy: uuid("appeal_decision_by").references(() => users.id),
  academicPlan: text("academic_plan"),

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentYearIdx: index("sap_records_student_year_idx").on(table.studentId, table.awardYearId),
  statusIdx: index("sap_records_status_idx").on(table.sapStatus),
}));

// Return to Title IV (R2T4) Calculation
export const r2t4Calculations = aidSchema.table("r2t4_calculations", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  termId: uuid("term_id")
    .notNull()
    .references(() => terms.id),

  // Withdrawal information
  withdrawalDate: date("withdrawal_date").notNull(),
  lastDateOfAttendance: date("last_date_of_attendance"),
  withdrawalType: varchar("withdrawal_type", { length: 20 }), // official, unofficial

  // Payment period
  paymentPeriodStart: date("payment_period_start").notNull(),
  paymentPeriodEnd: date("payment_period_end").notNull(),
  calendarDaysInPeriod: smallint("calendar_days_in_period"),
  daysCompleted: smallint("days_completed"),

  // Percentage completed
  percentageCompleted: decimal("percentage_completed", { precision: 5, scale: 4 }),
  earnedPercentage: decimal("earned_percentage", { precision: 5, scale: 4 }),

  // Title IV aid
  totalTitleIvDisbursed: decimal("total_title_iv_disbursed", { precision: 10, scale: 2 }),
  totalTitleIvCouldDisburse: decimal("total_title_iv_could_disburse", { precision: 10, scale: 2 }),
  titleIvAidEarned: decimal("title_iv_aid_earned", { precision: 10, scale: 2 }),
  titleIvAidToReturn: decimal("title_iv_aid_to_return", { precision: 10, scale: 2 }),

  // Institutional charges
  institutionalCharges: decimal("institutional_charges", { precision: 10, scale: 2 }),

  // School's portion to return
  schoolReturn: decimal("school_return", { precision: 10, scale: 2 }),

  // Student's portion to return
  studentReturn: decimal("student_return", { precision: 10, scale: 2 }),

  // Post-withdrawal disbursement
  postWithdrawalDisbursementAmount: decimal("post_withdrawal_disbursement_amount", { precision: 10, scale: 2 }),
  postWithdrawalDisbursementOffered: boolean("post_withdrawal_disbursement_offered"),
  postWithdrawalDisbursementAccepted: boolean("post_withdrawal_disbursement_accepted"),

  // Return order (amounts returned to each fund)
  returnDetails: jsonb("return_details").$type<R2T4ReturnDetail[]>(),

  // Status
  status: varchar("status", { length: 20 }).default("calculated").notNull(),
  // calculated, in_progress, completed, adjusted

  // Dates
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  returnDeadline: date("return_deadline"), // 45 days from determination

  calculatedBy: uuid("calculated_by").references(() => users.id),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTermIdx: index("r2t4_calculations_student_term_idx").on(table.studentId, table.termId),
  statusIdx: index("r2t4_calculations_status_idx").on(table.status),
}));

export interface R2T4ReturnDetail {
  fundCode: string;
  fundName: string;
  disbursedAmount: number;
  earnedAmount: number;
  returnAmount: number;
  returnedDate?: string;
  returnedBy: "school" | "student";
}

// Relations
export const awardYearsRelations = relations(awardYears, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [awardYears.institutionId],
    references: [institutions.id],
  }),
  funds: many(funds),
  isirRecords: many(isirRecords),
  aidApplications: many(aidApplications),
  sapRecords: many(sapRecords),
}));

export const fundTypesRelations = relations(fundTypes, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [fundTypes.institutionId],
    references: [institutions.id],
  }),
  funds: many(funds),
}));

export const fundsRelations = relations(funds, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [funds.institutionId],
    references: [institutions.id],
  }),
  fundType: one(fundTypes, {
    fields: [funds.fundTypeId],
    references: [fundTypes.id],
  }),
  awardYear: one(awardYears, {
    fields: [funds.awardYearId],
    references: [awardYears.id],
  }),
  aidAwards: many(aidAwards),
}));

export const isirRecordsRelations = relations(isirRecords, ({ one }) => ({
  student: one(students, {
    fields: [isirRecords.studentId],
    references: [students.id],
  }),
  awardYear: one(awardYears, {
    fields: [isirRecords.awardYearId],
    references: [awardYears.id],
  }),
}));

export const aidApplicationsRelations = relations(aidApplications, ({ one, many }) => ({
  student: one(students, {
    fields: [aidApplications.studentId],
    references: [students.id],
  }),
  awardYear: one(awardYears, {
    fields: [aidApplications.awardYearId],
    references: [awardYears.id],
  }),
  studentProgram: one(studentPrograms, {
    fields: [aidApplications.studentProgramId],
    references: [studentPrograms.id],
  }),
  activeIsir: one(isirRecords, {
    fields: [aidApplications.activeIsirId],
    references: [isirRecords.id],
  }),
  awards: many(aidAwards),
}));

export const aidAwardsRelations = relations(aidAwards, ({ one, many }) => ({
  aidApplication: one(aidApplications, {
    fields: [aidAwards.aidApplicationId],
    references: [aidApplications.id],
  }),
  fund: one(funds, {
    fields: [aidAwards.fundId],
    references: [funds.id],
  }),
  awardedByUser: one(users, {
    fields: [aidAwards.awardedBy],
    references: [users.id],
  }),
  disbursementSchedules: many(disbursementSchedules),
}));

export const disbursementSchedulesRelations = relations(disbursementSchedules, ({ one }) => ({
  aidAward: one(aidAwards, {
    fields: [disbursementSchedules.aidAwardId],
    references: [aidAwards.id],
  }),
  term: one(terms, {
    fields: [disbursementSchedules.termId],
    references: [terms.id],
  }),
  ledgerEntry: one(ledgerEntries, {
    fields: [disbursementSchedules.ledgerEntryId],
    references: [ledgerEntries.id],
  }),
}));

export const sapRecordsRelations = relations(sapRecords, ({ one }) => ({
  student: one(students, {
    fields: [sapRecords.studentId],
    references: [students.id],
  }),
  awardYear: one(awardYears, {
    fields: [sapRecords.awardYearId],
    references: [awardYears.id],
  }),
  term: one(terms, {
    fields: [sapRecords.termId],
    references: [terms.id],
  }),
  appealDecisionByUser: one(users, {
    fields: [sapRecords.appealDecisionBy],
    references: [users.id],
  }),
}));

export const r2t4CalculationsRelations = relations(r2t4Calculations, ({ one }) => ({
  student: one(students, {
    fields: [r2t4Calculations.studentId],
    references: [students.id],
  }),
  term: one(terms, {
    fields: [r2t4Calculations.termId],
    references: [terms.id],
  }),
  calculatedByUser: one(users, {
    fields: [r2t4Calculations.calculatedBy],
    references: [users.id],
  }),
}));
