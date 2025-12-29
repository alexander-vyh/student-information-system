/**
 * Audit Logger
 *
 * Structured logging for FERPA compliance.
 * Logs all access to student education records.
 *
 * Design Decisions:
 * - Async logging to avoid blocking requests
 * - Structured JSON format for analysis
 * - Dual output: database + stdout (for log aggregation)
 * - Immutable logs (no updates or deletes)
 */

import { db } from "@sis/db";
import { auditLogs } from "@sis/db/schema";
import type {
  AuditLogEntry,
  AuditContext,
  AuditCategory,
  AuditAction,
} from "./types.js";
import type { Context } from "../trpc.js";

/**
 * Generate unique audit event ID
 */
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `audit_${timestamp}_${random}`;
}

/**
 * Create audit log entry
 */
export function createAuditEntry(
  ctx: Context,
  auditCtx: AuditContext,
  outcome: "success" | "failure" | "denied",
  errorMessage?: string
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    category: auditCtx.category,
    action: auditCtx.action,
    resourceType: auditCtx.resourceType,
    resourceId: auditCtx.resourceId,
    actor: ctx.user
      ? {
          userId: ctx.user.id,
          email: ctx.user.email,
          roles: ctx.user.roles,
          institutionId: ctx.user.institutionId,
          studentId: ctx.user.studentId,
        }
      : {
          userId: "anonymous",
          email: "",
          roles: [],
          institutionId: "",
        },
    subject: auditCtx.studentId
      ? {
          studentId: auditCtx.studentId,
        }
      : undefined,
    request: {
      ip: ctx.req.ip,
      userAgent: ctx.req.userAgent,
    },
    outcome,
    details: auditCtx.details,
    errorMessage,
  };

  return entry;
}

/**
 * Write audit log entry to database and stdout
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  // Log to stdout for log aggregation (ELK, CloudWatch, etc.)
  console.log(JSON.stringify({ type: "AUDIT_LOG", ...entry }));

  // Persist to database (async, non-blocking)
  try {
    await db.insert(auditLogs).values({
      institutionId: entry.actor.institutionId || "00000000-0000-0000-0000-000000000000",
      userId: entry.actor.userId !== "anonymous" ? entry.actor.userId : null,
      userEmail: entry.actor.email || null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      studentId: entry.subject?.studentId,
      ipAddress: entry.request.ip,
      userAgent: entry.request.userAgent,
      requestPath: entry.request.path,
      requestMethod: entry.request.method,
      metadata: {
        category: entry.category,
        trpcProcedure: entry.request.trpcProcedure,
        actorRoles: entry.actor.roles,
        details: entry.details,
        correlationId: entry.correlationId,
      },
      success: entry.outcome === "success",
      errorMessage: entry.errorMessage,
    });
  } catch (error) {
    // Never fail the request due to audit logging
    console.error("Failed to write audit log to database:", error);
  }
}

/**
 * High-level audit function for procedures
 */
export async function audit(
  ctx: Context,
  auditCtx: AuditContext,
  outcome: "success" | "failure" | "denied",
  errorMessage?: string
): Promise<void> {
  const entry = createAuditEntry(ctx, auditCtx, outcome, errorMessage);
  await writeAuditLog(entry);
}

/**
 * Audit login attempt
 */
export async function auditLogin(
  email: string,
  success: boolean,
  ip?: string,
  userAgent?: string,
  errorReason?: string
): Promise<void> {
  const entry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    category: "authentication",
    action: success ? "login" : "failed_login",
    resourceType: "session",
    actor: {
      userId: "pending",
      email,
      roles: [],
      institutionId: "",
    },
    request: {
      ip,
      userAgent,
    },
    outcome: success ? "success" : "failure",
    errorMessage: errorReason,
  };

  await writeAuditLog(entry);
}

/**
 * Audit logout
 */
export async function auditLogout(
  userId: string,
  email: string,
  institutionId: string,
  ip?: string
): Promise<void> {
  const entry: AuditLogEntry = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    category: "authentication",
    action: "logout",
    resourceType: "session",
    actor: {
      userId,
      email,
      roles: [],
      institutionId,
    },
    request: { ip },
    outcome: "success",
  };

  await writeAuditLog(entry);
}

/**
 * Audit student record access (FERPA tracking)
 */
export async function auditStudentRecordAccess(
  ctx: Context,
  studentId: string,
  action: AuditAction,
  resourceType: "student" | "registration" | "grade" | "transcript",
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  await audit(
    ctx,
    {
      category: "student_record",
      action,
      resourceType,
      resourceId,
      studentId,
      details,
    },
    "success"
  );
}

/**
 * Audit permission denied
 */
export async function auditPermissionDenied(
  ctx: Context,
  category: AuditCategory,
  resourceType: AuditLogEntry["resourceType"],
  resourceId?: string,
  studentId?: string,
  reason?: string
): Promise<void> {
  await audit(
    ctx,
    {
      category,
      action: "permission_denied",
      resourceType,
      resourceId,
      studentId,
      details: { reason },
    },
    "denied",
    reason
  );
}
