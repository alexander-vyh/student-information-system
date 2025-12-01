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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions, terms } from "./core.js";
import { users } from "./identity.js";
import { students } from "./student.js";

// Financial schema for student accounts and bursar functions
export const financialSchema = pgSchema("financial");

// Student Account
export const accounts = financialSchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  accountNumber: varchar("account_number", { length: 20 }).notNull(),

  // Balance (denormalized for performance)
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0").notNull(),
  pendingCharges: decimal("pending_charges", { precision: 12, scale: 2 }).default("0"),
  pendingCredits: decimal("pending_credits", { precision: 12, scale: 2 }).default("0"),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(),

  // Holds
  hasFinancialHold: boolean("has_financial_hold").default(false),

  // Payment plan
  onPaymentPlan: boolean("on_payment_plan").default(false),
  paymentPlanId: uuid("payment_plan_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("accounts_student_idx").on(table.studentId),
  accountNumberIdx: index("accounts_account_number_idx").on(table.accountNumber),
}));

// Charge Code (types of charges)
export const chargeCodes = financialSchema.table("charge_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Categorization
  category: varchar("category", { length: 30 }).notNull(), // tuition, fees, housing, meal_plan, other

  // For 1098-T reporting
  isQtre: boolean("is_qtre").default(false), // Qualified Tuition and Related Expenses
  box1Eligible: boolean("box_1_eligible").default(false), // Counts in Box 1

  // GL account (for integration)
  glAccountCode: varchar("gl_account_code", { length: 30 }),

  // Refund rules
  refundable: boolean("refundable").default(true),
  refundRuleId: uuid("refund_rule_id"),

  // Active for assessment
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Ledger Entry (all financial transactions)
export const ledgerEntries = financialSchema.table("ledger_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),

  // Transaction identification
  transactionNumber: varchar("transaction_number", { length: 30 }),
  referenceNumber: varchar("reference_number", { length: 50 }),

  // Type and code
  entryType: varchar("entry_type", { length: 20 }).notNull(), // charge, payment, credit, adjustment, refund
  chargeCodeId: uuid("charge_code_id").references(() => chargeCodes.id),

  // Dates
  transactionDate: date("transaction_date").notNull(),
  effectiveDate: date("effective_date").notNull(),
  dueDate: date("due_date"),

  // Amount (positive = debit/charge, negative = credit/payment)
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  // Term association
  termId: uuid("term_id").references(() => terms.id),

  // Description
  description: text("description"),

  // For 1098-T (computed column in PostgreSQL)
  taxYear: smallint("tax_year"), // Will be populated via trigger or application
  isQtre: boolean("is_qtre").default(false),

  // Payment details
  paymentMethod: varchar("payment_method", { length: 30 }), // cash, check, card, ach, financial_aid
  checkNumber: varchar("check_number", { length: 20 }),
  cardLast4: varchar("card_last_4", { length: 4 }),

  // For adjustments/refunds - link to original
  originalEntryId: uuid("original_entry_id"),

  // Status
  status: varchar("status", { length: 20 }).default("posted").notNull(), // pending, posted, voided, reversed

  // Posted by
  postedBy: uuid("posted_by").references(() => users.id),

  // Batch (for batch posting)
  batchId: uuid("batch_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("ledger_entries_account_idx").on(table.accountId),
  transactionDateIdx: index("ledger_entries_transaction_date_idx").on(table.transactionDate),
  termIdx: index("ledger_entries_term_idx").on(table.termId),
  taxYearQtreIdx: index("ledger_entries_tax_year_qtre_idx").on(table.taxYear, table.isQtre),
  statusIdx: index("ledger_entries_status_idx").on(table.status),
}));

// Payment Plan
export const paymentPlans = financialSchema.table("payment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  termId: uuid("term_id")
    .references(() => terms.id),

  planType: varchar("plan_type", { length: 30 }).notNull(), // standard, extended, custom
  planName: varchar("plan_name", { length: 100 }),

  // Plan amounts
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  downPayment: decimal("down_payment", { precision: 12, scale: 2 }).default("0"),
  enrollmentFee: decimal("enrollment_fee", { precision: 10, scale: 2 }).default("0"),

  // Payment schedule
  numberOfPayments: smallint("number_of_payments").notNull(),
  paymentAmount: decimal("payment_amount", { precision: 12, scale: 2 }),

  // Dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // pending, active, completed, defaulted, cancelled

  // Balance
  remainingBalance: decimal("remaining_balance", { precision: 12, scale: 2 }),
  missedPayments: smallint("missed_payments").default(0),

  // Agreement
  agreementSignedAt: timestamp("agreement_signed_at", { withTimezone: true }),
  agreementIp: varchar("agreement_ip", { length: 45 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("payment_plans_account_idx").on(table.accountId),
}));

// Payment Plan Installment
export const paymentPlanInstallments = financialSchema.table("payment_plan_installments", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentPlanId: uuid("payment_plan_id")
    .notNull()
    .references(() => paymentPlans.id, { onDelete: "cascade" }),

  installmentNumber: smallint("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

  // Status
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, paid, partial, overdue

  // Payment
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  paidDate: date("paid_date"),
  ledgerEntryId: uuid("ledger_entry_id").references(() => ledgerEntries.id),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Refund Rule
export const refundRules = financialSchema.table("refund_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Rule type
  ruleType: varchar("rule_type", { length: 30 }).notNull(), // date_based, percentage, pro_rata

  // Schedule (JSON array of date ranges and percentages)
  schedule: jsonb("schedule").$type<RefundScheduleEntry[]>(),

  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export interface RefundScheduleEntry {
  startDay: number; // Days from term start
  endDay: number;
  refundPercentage: number;
}

// 1098-T Record (for tax year reporting)
export const form1098tRecords = financialSchema.table("form_1098t_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),

  taxYear: smallint("tax_year").notNull(),

  // Box 1: Payments received for QTRE
  box1Amount: decimal("box_1_amount", { precision: 12, scale: 2 }).default("0"),

  // Box 4: Adjustments to prior year
  box4Amount: decimal("box_4_amount", { precision: 12, scale: 2 }).default("0"),

  // Box 5: Scholarships or grants
  box5Amount: decimal("box_5_amount", { precision: 12, scale: 2 }).default("0"),

  // Box 6: Adjustments to scholarships
  box6Amount: decimal("box_6_amount", { precision: 12, scale: 2 }).default("0"),

  // Box 7: Checkbox - includes amounts for academic period beginning January-March
  box7Checked: boolean("box_7_checked").default(false),

  // Box 8: At least half-time student
  box8Checked: boolean("box_8_checked").default(false),

  // Box 9: Graduate student
  box9Checked: boolean("box_9_checked").default(false),

  // Student information (as of filing)
  studentSsnLast4: varchar("student_ssn_last_4", { length: 4 }),
  studentName: varchar("student_name", { length: 200 }),
  studentAddress: jsonb("student_address").$type<{
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  }>(),

  // Filing status
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, generated, filed, corrected

  // Generated/filed dates
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  filedAt: timestamp("filed_at", { withTimezone: true }),

  // Correction tracking
  isCorrected: boolean("is_corrected").default(false),
  originalRecordId: uuid("original_record_id"),
  correctionReason: text("correction_reason"),

  // FIRE submission
  fireSubmissionId: varchar("fire_submission_id", { length: 50 }),
  fireAcceptedAt: timestamp("fire_accepted_at", { withTimezone: true }),

  // Student access (electronic delivery)
  electronicConsentAt: timestamp("electronic_consent_at", { withTimezone: true }),
  studentAccessedAt: timestamp("student_accessed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentTaxYearIdx: index("form_1098t_records_student_tax_year_idx").on(table.studentId, table.taxYear),
  taxYearStatusIdx: index("form_1098t_records_tax_year_status_idx").on(table.taxYear, table.status),
}));

// Financial Hold
export const financialHolds = financialSchema.table("financial_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),

  holdType: varchar("hold_type", { length: 30 }).notNull(), // balance_due, payment_plan_default, returned_payment

  holdCode: varchar("hold_code", { length: 20 }).notNull(),
  holdName: varchar("hold_name", { length: 100 }).notNull(),
  description: text("description"),

  // Threshold amount that triggered the hold
  thresholdAmount: decimal("threshold_amount", { precision: 12, scale: 2 }),
  currentAmount: decimal("current_amount", { precision: 12, scale: 2 }),

  // What is blocked
  blocksRegistration: boolean("blocks_registration").default(true),
  blocksGrades: boolean("blocks_grades").default(false),
  blocksTranscript: boolean("blocks_transcript").default(false),
  blocksDiploma: boolean("blocks_diploma").default(false),

  // Auto-release when balance drops below
  autoReleaseThreshold: decimal("auto_release_threshold", { precision: 12, scale: 2 }),

  // Effective dates
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),

  // Resolution
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolutionNotes: text("resolution_notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index("financial_holds_account_idx").on(table.accountId),
}));

// Third-party contract (for sponsor billing)
export const thirdPartyContracts = financialSchema.table("third_party_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Sponsor information
  sponsorName: varchar("sponsor_name", { length: 200 }).notNull(),
  sponsorCode: varchar("sponsor_code", { length: 20 }),

  // Contact
  contactName: varchar("contact_name", { length: 100 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),

  // Address
  billingAddress: jsonb("billing_address").$type<{
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  }>(),

  // Contract terms
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),

  // What's covered
  coversTuition: boolean("covers_tuition").default(true),
  coversFees: boolean("covers_fees").default(false),
  coversHousing: boolean("covers_housing").default(false),
  coversMealPlan: boolean("covers_meal_plan").default(false),
  maxAmount: decimal("max_amount", { precision: 12, scale: 2 }),

  // Billing frequency
  billingFrequency: varchar("billing_frequency", { length: 20 }), // monthly, term, annual

  status: varchar("status", { length: 20 }).default("active").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Third-party authorization (link student to sponsor)
export const thirdPartyAuthorizations = financialSchema.table("third_party_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => thirdPartyContracts.id),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  termId: uuid("term_id")
    .references(() => terms.id),

  // Authorization amount
  authorizedAmount: decimal("authorized_amount", { precision: 12, scale: 2 }),
  usedAmount: decimal("used_amount", { precision: 12, scale: 2 }).default("0"),

  // What's covered (may be subset of contract)
  coversTuition: boolean("covers_tuition").default(true),
  coversFees: boolean("covers_fees").default(false),

  authorizationNumber: varchar("authorization_number", { length: 50 }),

  status: varchar("status", { length: 20 }).default("active").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  studentIdx: index("third_party_authorizations_student_idx").on(table.studentId),
  contractIdx: index("third_party_authorizations_contract_idx").on(table.contractId),
}));

// Relations
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [accounts.institutionId],
    references: [institutions.id],
  }),
  student: one(students, {
    fields: [accounts.studentId],
    references: [students.id],
  }),
  ledgerEntries: many(ledgerEntries),
  paymentPlans: many(paymentPlans),
  financialHolds: many(financialHolds),
}));

export const chargeCodesRelations = relations(chargeCodes, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [chargeCodes.institutionId],
    references: [institutions.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  account: one(accounts, {
    fields: [ledgerEntries.accountId],
    references: [accounts.id],
  }),
  chargeCode: one(chargeCodes, {
    fields: [ledgerEntries.chargeCodeId],
    references: [chargeCodes.id],
  }),
  term: one(terms, {
    fields: [ledgerEntries.termId],
    references: [terms.id],
  }),
  postedByUser: one(users, {
    fields: [ledgerEntries.postedBy],
    references: [users.id],
  }),
}));

export const paymentPlansRelations = relations(paymentPlans, ({ one, many }) => ({
  account: one(accounts, {
    fields: [paymentPlans.accountId],
    references: [accounts.id],
  }),
  term: one(terms, {
    fields: [paymentPlans.termId],
    references: [terms.id],
  }),
  installments: many(paymentPlanInstallments),
}));

export const paymentPlanInstallmentsRelations = relations(paymentPlanInstallments, ({ one }) => ({
  paymentPlan: one(paymentPlans, {
    fields: [paymentPlanInstallments.paymentPlanId],
    references: [paymentPlans.id],
  }),
  ledgerEntry: one(ledgerEntries, {
    fields: [paymentPlanInstallments.ledgerEntryId],
    references: [ledgerEntries.id],
  }),
}));

export const form1098tRecordsRelations = relations(form1098tRecords, ({ one }) => ({
  institution: one(institutions, {
    fields: [form1098tRecords.institutionId],
    references: [institutions.id],
  }),
  student: one(students, {
    fields: [form1098tRecords.studentId],
    references: [students.id],
  }),
}));

export const financialHoldsRelations = relations(financialHolds, ({ one }) => ({
  account: one(accounts, {
    fields: [financialHolds.accountId],
    references: [accounts.id],
  }),
  resolvedByUser: one(users, {
    fields: [financialHolds.resolvedBy],
    references: [users.id],
  }),
}));

export const thirdPartyContractsRelations = relations(thirdPartyContracts, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [thirdPartyContracts.institutionId],
    references: [institutions.id],
  }),
  authorizations: many(thirdPartyAuthorizations),
}));

export const thirdPartyAuthorizationsRelations = relations(thirdPartyAuthorizations, ({ one }) => ({
  contract: one(thirdPartyContracts, {
    fields: [thirdPartyAuthorizations.contractId],
    references: [thirdPartyContracts.id],
  }),
  student: one(students, {
    fields: [thirdPartyAuthorizations.studentId],
    references: [students.id],
  }),
  term: one(terms, {
    fields: [thirdPartyAuthorizations.termId],
    references: [terms.id],
  }),
}));
