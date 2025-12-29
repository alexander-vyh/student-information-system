import {
  pgSchema,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { institutions } from "./core.js";
import { users } from "./identity.js";

/**
 * System Schema
 *
 * Provides system-level infrastructure including:
 * - Change Data Capture (CDC) for audit trail
 * - System configuration with temporal pattern
 * - Background job tracking
 *
 * The change_log table captures all DML operations on tracked tables
 * via PostgreSQL triggers, enabling:
 * - Regulatory compliance (FERPA audit trail)
 * - Data recovery and forensics
 * - Change analytics and reporting
 */
export const systemSchema = pgSchema("system");

// =============================================================================
// CHANGE DATA CAPTURE (CDC)
// =============================================================================

/**
 * Change Log - captures all data modifications for audit trail
 *
 * Populated via PostgreSQL triggers on tracked tables.
 * Uses JSONB for flexible before/after snapshots.
 *
 * Retention policy: Typically 7 years for FERPA/financial records
 */
export const changeLog = systemSchema.table("change_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Tenant scope
  institutionId: uuid("institution_id").references(() => institutions.id),

  // What changed
  schemaName: varchar("schema_name", { length: 63 }).notNull(),
  tableName: varchar("table_name", { length: 63 }).notNull(),
  recordId: uuid("record_id"), // Primary key of changed record (if UUID)
  recordIdText: varchar("record_id_text", { length: 100 }), // For non-UUID PKs

  // Type of change
  operation: varchar("operation", { length: 10 }).notNull(), // INSERT, UPDATE, DELETE

  // Before/after snapshots (NULL for INSERT old_data, NULL for DELETE new_data)
  oldData: jsonb("old_data").$type<Record<string, unknown>>(),
  newData: jsonb("new_data").$type<Record<string, unknown>>(),

  // Changed fields (for UPDATE operations - easier filtering)
  changedFields: jsonb("changed_fields").$type<string[]>(),

  // Who made the change
  changedBy: uuid("changed_by").references(() => users.id),
  changedByUsername: varchar("changed_by_username", { length: 100 }),

  // Context
  sessionId: varchar("session_id", { length: 100 }), // Application session
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4/IPv6
  userAgent: text("user_agent"),
  changeReason: text("change_reason"), // Optional: why the change was made

  // Timing
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),

  // Transaction context (for grouping related changes)
  transactionId: varchar("transaction_id", { length: 50 }),
}, (table) => ({
  // Primary query patterns
  tableRecordIdx: index("change_log_table_record_idx").on(
    table.schemaName,
    table.tableName,
    table.recordId
  ),
  institutionTimeIdx: index("change_log_institution_time_idx").on(
    table.institutionId,
    table.changedAt
  ),
  userTimeIdx: index("change_log_user_time_idx").on(
    table.changedBy,
    table.changedAt
  ),
  // For finding all changes in a transaction
  transactionIdx: index("change_log_transaction_idx").on(table.transactionId),
  // Time-based partitioning support (if needed later)
  changedAtIdx: index("change_log_changed_at_idx").on(table.changedAt),
}));

/**
 * Tracked Tables - configuration for which tables to track
 * Enables selective CDC without modifying trigger for each table
 */
export const trackedTables = systemSchema.table("tracked_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  schemaName: varchar("schema_name", { length: 63 }).notNull(),
  tableName: varchar("table_name", { length: 63 }).notNull(),

  // What to track
  trackInserts: boolean("track_inserts").default(true),
  trackUpdates: boolean("track_updates").default(true),
  trackDeletes: boolean("track_deletes").default(true),

  // What to capture
  captureOldData: boolean("capture_old_data").default(true),
  captureNewData: boolean("capture_new_data").default(true),

  // Columns to exclude from logging (e.g., passwords, tokens)
  excludedColumns: jsonb("excluded_columns").$type<string[]>(),

  // Retention
  retentionDays: integer("retention_days").default(2555), // ~7 years

  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// INSTITUTION SETTINGS WITH TEMPORAL PATTERN
// =============================================================================

/**
 * Institution Settings - time-versioned configuration
 *
 * Uses temporal pattern for full history of configuration changes.
 * Each setting change creates a new row with validFrom/validTo dates.
 */
export const institutionSettings = systemSchema.table("institution_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Setting identification
  settingKey: varchar("setting_key", { length: 100 }).notNull(),
  settingCategory: varchar("setting_category", { length: 50 }).notNull(), // registration, grading, financial, scheduling

  // Setting value (JSONB for flexibility)
  settingValue: jsonb("setting_value").$type<unknown>().notNull(),

  // Description for UI
  displayName: varchar("display_name", { length: 200 }),
  description: text("description"),

  // Temporal tracking
  validFrom: timestamp("valid_from", { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }), // NULL = current
  changedBy: uuid("changed_by").references(() => users.id),
  changeReason: varchar("change_reason", { length: 200 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  institutionKeyIdx: index("institution_settings_institution_key_idx").on(
    table.institutionId,
    table.settingKey
  ),
  categoryIdx: index("institution_settings_category_idx").on(
    table.institutionId,
    table.settingCategory
  ),
  // Partial index for current settings
  currentIdx: index("institution_settings_current_idx")
    .on(table.institutionId, table.settingKey)
    .where(sql`valid_to IS NULL`),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const changeLogRelations = relations(changeLog, ({ one }) => ({
  institution: one(institutions, {
    fields: [changeLog.institutionId],
    references: [institutions.id],
  }),
  changedByUser: one(users, {
    fields: [changeLog.changedBy],
    references: [users.id],
  }),
}));

export const institutionSettingsRelations = relations(institutionSettings, ({ one }) => ({
  institution: one(institutions, {
    fields: [institutionSettings.institutionId],
    references: [institutions.id],
  }),
  changedByUser: one(users, {
    fields: [institutionSettings.changedBy],
    references: [users.id],
  }),
}));

// =============================================================================
// TYPE IMPORTS FOR JSONB
// =============================================================================

import { boolean, integer } from "drizzle-orm/pg-core";
