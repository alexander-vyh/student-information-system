/**
 * Audit Log Types
 *
 * Type definitions for FERPA-compliant audit logging.
 * Tracks all access to student education records.
 */

/**
 * Audit event categories
 */
export type AuditCategory =
  | "authentication" // Login, logout, session events
  | "student_record" // Access to student education records
  | "financial_record" // Access to financial/billing records
  | "aid_record" // Access to financial aid records
  | "enrollment" // Registration activities
  | "grade" // Grade viewing/changes
  | "transcript" // Transcript generation/access
  | "graduation" // Graduation applications/conferral
  | "admin" // Administrative actions
  | "system"; // System events

/**
 * Audit action types
 */
export type AuditAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "print"
  | "search"
  | "login"
  | "logout"
  | "failed_login"
  | "permission_denied"
  | "override"
  | "generate" // Generate document (transcript, report)
  | "confer" // Confer degree
  | "batch_confer" // Batch degree conferral
  | "release"; // Release transcript/document

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | "student"
  | "registration"
  | "grade"
  | "transcript"
  | "transcript_request"
  | "graduation_application"
  | "degree_conferral"
  | "diploma"
  | "ceremony"
  | "financial_account"
  | "financial_aid"
  | "hold"
  | "user"
  | "session"
  | "report";

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Unique event ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event category */
  category: AuditCategory;
  /** Specific action taken */
  action: AuditAction;
  /** Type of resource accessed */
  resourceType: AuditResourceType;
  /** ID of the resource (if applicable) */
  resourceId?: string;

  /** User who performed the action */
  actor: {
    userId: string;
    email: string;
    roles: string[];
    institutionId: string;
    /** If actor is also a student */
    studentId?: string;
  };

  /** Student whose record was accessed (for FERPA tracking) */
  subject?: {
    studentId: string;
    studentName?: string;
  };

  /** Request context */
  request: {
    ip?: string;
    userAgent?: string;
    method?: string;
    path?: string;
    trpcProcedure?: string;
  };

  /** Operation outcome */
  outcome: "success" | "failure" | "denied";

  /** Additional context */
  details?: Record<string, unknown>;

  /** Error message if failed */
  errorMessage?: string;

  /** Related audit events (for complex operations) */
  correlationId?: string;
}

/**
 * Audit log context for procedures
 */
export interface AuditContext {
  category: AuditCategory;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  studentId?: string;
  details?: Record<string, unknown>;
}
