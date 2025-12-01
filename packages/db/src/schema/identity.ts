import {
  pgTable,
  pgSchema,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  inet,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { institutions } from "./core.js";

// Identity schema for authentication and authorization
export const identitySchema = pgSchema("identity");

// User account
export const users = identitySchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Authentication
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  passwordHash: varchar("password_hash", { length: 255 }), // null for SSO-only users

  // Profile
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  preferredName: varchar("preferred_name", { length: 100 }),
  displayName: varchar("display_name", { length: 200 }),

  // External IDs
  externalId: varchar("external_id", { length: 100 }), // SSO/IdP identifier
  employeeId: varchar("employee_id", { length: 50 }),

  // Contact
  phone: varchar("phone", { length: 20 }),

  // Avatar/Profile image
  avatarUrl: varchar("avatar_url", { length: 500 }),

  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, inactive, suspended, locked
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedLoginAttempts: varchar("failed_login_attempts", { length: 10 }).default("0"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),

  // MFA
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: varchar("mfa_secret", { length: 255 }),

  // Password policy
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  mustChangePassword: boolean("must_change_password").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailInstitutionIdx: index("users_email_institution_idx").on(table.email, table.institutionId),
  externalIdIdx: index("users_external_id_idx").on(table.externalId),
}));

// Session for server-side session management
export const sessions = identitySchema.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),

  // Session metadata
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index("sessions_token_idx").on(table.sessionToken),
  userExpiresIdx: index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
}));

// Role definition
export const roles = identitySchema.table("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .references(() => institutions.id), // null = system-wide role

  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  // Role type
  roleType: varchar("role_type", { length: 20 }).default("functional").notNull(), // functional, data, system

  // System roles cannot be modified
  isSystem: boolean("is_system").default(false),

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Permission definition
export const permissions = identitySchema.table("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),

  code: varchar("code", { length: 100 }).notNull().unique(), // e.g., "student:read", "enrollment:create"
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),

  // Permission categorization
  resource: varchar("resource", { length: 50 }).notNull(), // student, enrollment, financial, etc.
  action: varchar("action", { length: 20 }).notNull(), // create, read, update, delete, export

  // Some permissions support row-level scope
  supportsSelfScope: boolean("supports_self_scope").default(false), // student:read:self

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Role-Permission mapping
export const rolePermissions = identitySchema.table("role_permissions", {
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),

  // Optional scope restrictions
  scope: varchar("scope", { length: 20 }), // null = all, "self" = own records only

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

// User-Role assignment
export const userRoles = identitySchema.table("user_roles", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),

  // Optional: restrict role to specific data scope
  // e.g., advisor role only for specific department
  scopeType: varchar("scope_type", { length: 50 }), // department, program, campus
  scopeId: uuid("scope_id"),

  // Effective dates (for temporary role assignments)
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),

  assignedBy: uuid("assigned_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
  userIdx: index("user_roles_user_idx").on(table.userId),
}));

// Audit log for FERPA compliance
export const auditLogs = identitySchema.table("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id),

  // Who performed the action
  userId: uuid("user_id").references(() => users.id),
  userEmail: varchar("user_email", { length: 255 }), // Denormalized for retention

  // What action was performed
  action: varchar("action", { length: 50 }).notNull(), // read, create, update, delete, export, login, logout
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // student, enrollment, financial, etc.
  resourceId: uuid("resource_id"),

  // For FERPA: track which student's records were accessed
  studentId: uuid("student_id"),

  // Request context
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  requestPath: varchar("request_path", { length: 500 }),
  requestMethod: varchar("request_method", { length: 10 }),

  // Change details (for updates)
  changes: jsonb("changes").$type<{
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    fields?: string[];
  }>(),

  // Additional context
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  // Result
  success: boolean("success").default(true),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for common queries
  userIdx: index("audit_logs_user_idx").on(table.userId),
  studentIdx: index("audit_logs_student_idx").on(table.studentId),
  resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  institutionCreatedIdx: index("audit_logs_institution_created_idx").on(table.institutionId, table.createdAt),
}));

// OAuth accounts (for SSO)
export const oauthAccounts = identitySchema.table("oauth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  provider: varchar("provider", { length: 50 }).notNull(), // google, microsoft, saml
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),

  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),

  // SAML/OIDC specifics
  idToken: text("id_token"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerAccountIdx: index("accounts_provider_account_idx").on(table.provider, table.providerAccountId),
}));

// Password reset tokens
export const passwordResetTokens = identitySchema.table("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Email verification tokens
export const emailVerificationTokens = identitySchema.table("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [users.institutionId],
    references: [institutions.id],
  }),
  sessions: many(sessions),
  userRoles: many(userRoles, { relationName: "userToRoles" }),
  assignedRoles: many(userRoles, { relationName: "assignedByUser" }),
  accounts: many(oauthAccounts),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [roles.institutionId],
    references: [institutions.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
    relationName: "userToRoles",
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
    relationName: "assignedByUser",
  }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  institution: one(institutions, {
    fields: [auditLogs.institutionId],
    references: [institutions.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
