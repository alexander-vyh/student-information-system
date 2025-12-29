/**
 * Error Mapper
 *
 * Converts typed domain errors to TRPCError while preserving
 * the original error in `cause` for frontend type-safe handling.
 *
 * Usage:
 *   import { mapToTRPC } from "../errors/mapper.js";
 *
 *   // In a router
 *   const result = await service.enroll(input);
 *   if (!result.ok) {
 *     throw mapToTRPC(result.error);
 *   }
 *
 * Frontend can access typed error:
 *   try {
 *     await trpc.enrollment.enroll.mutate(input);
 *   } catch (e) {
 *     if (e.data?.cause?.code === "SECTION_FULL") {
 *       const err = e.data.cause as SectionFullError;
 *       if (err.waitlistAvailable) showWaitlistPrompt();
 *     }
 *   }
 */

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import type { ApiError, BaseApiError } from "./types.js";

// =============================================================================
// TRPC Error Code Mapping
// =============================================================================

/**
 * Maps domain error codes to appropriate HTTP-equivalent TRPC codes.
 *
 * TRPC codes and their meanings:
 * - BAD_REQUEST (400): Client sent invalid data
 * - UNAUTHORIZED (401): No auth credentials
 * - FORBIDDEN (403): Auth valid but insufficient permissions
 * - NOT_FOUND (404): Resource doesn't exist
 * - CONFLICT (409): State conflict (e.g., duplicate)
 * - PRECONDITION_FAILED (412): Business rule violation
 * - INTERNAL_SERVER_ERROR (500): Unexpected server error
 */
const ERROR_CODE_TO_TRPC: Record<string, TRPC_ERROR_CODE_KEY> = {
  // Enrollment - mostly precondition failures (business rules)
  SECTION_FULL: "PRECONDITION_FAILED",
  PREREQUISITE_NOT_MET: "PRECONDITION_FAILED",
  HOLD_BLOCKING: "FORBIDDEN",
  SCHEDULE_CONFLICT: "CONFLICT",
  ALREADY_ENROLLED: "CONFLICT",
  ENROLLMENT_CLOSED: "PRECONDITION_FAILED",
  DROP_DEADLINE_PASSED: "PRECONDITION_FAILED",
  WITHDRAWAL_DEADLINE_PASSED: "PRECONDITION_FAILED",
  SECTION_NOT_FOUND: "NOT_FOUND",
  STUDENT_NOT_FOUND: "NOT_FOUND",
  MAX_CREDITS_EXCEEDED: "PRECONDITION_FAILED",
  CAPACITY_RESTRICTION: "FORBIDDEN",

  // Transfer Credit
  DUPLICATE_TRANSFER_CREDIT: "CONFLICT",
  INVALID_TRANSFER_INSTITUTION: "BAD_REQUEST",
  TRANSFER_CREDITS_EXCEED_LIMIT: "PRECONDITION_FAILED",
  TRANSFER_CREDIT_NOT_FOUND: "NOT_FOUND",
  TRANSFER_EVALUATION_PENDING: "PRECONDITION_FAILED",

  // Academic Standing
  STANDING_POLICY_NOT_FOUND: "NOT_FOUND",
  STANDING_CALCULATION_FAILED: "INTERNAL_SERVER_ERROR",
  INSUFFICIENT_CREDITS: "PRECONDITION_FAILED",

  // Graduation
  GRADUATION_REQUIREMENTS_NOT_MET: "PRECONDITION_FAILED",
  GRADUATION_APPLICATION_EXISTS: "CONFLICT",
  GRADUATION_APPLICATION_NOT_FOUND: "NOT_FOUND",
  GRADUATION_HOLD: "FORBIDDEN",
  DEGREE_ALREADY_CONFERRED: "CONFLICT",

  // Financial
  INSUFFICIENT_BALANCE: "PRECONDITION_FAILED",
  PAYMENT_FAILED: "BAD_REQUEST",
  ACCOUNT_NOT_FOUND: "NOT_FOUND",
  FINANCIAL_HOLD: "FORBIDDEN",

  // Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  FERPA_VIOLATION: "FORBIDDEN",

  // Generic
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_FAILED: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
};

// =============================================================================
// Error Message Formatting
// =============================================================================

/**
 * Generates a human-readable message for an error.
 * Uses the error's message field if present, otherwise generates from code.
 */
export function formatErrorMessage(error: BaseApiError): string {
  // If error has an explicit message, use it
  if (error.message) {
    return error.message;
  }

  // Otherwise generate from code
  const messages: Record<string, string> = {
    // Enrollment
    SECTION_FULL: "This section is at capacity",
    PREREQUISITE_NOT_MET: "Course prerequisites have not been completed",
    HOLD_BLOCKING: "A hold on your account prevents this action",
    SCHEDULE_CONFLICT: "This section conflicts with your current schedule",
    ALREADY_ENROLLED: "You are already enrolled in this course",
    ENROLLMENT_CLOSED: "Enrollment is not currently open for this term",
    DROP_DEADLINE_PASSED: "The drop deadline has passed for this course",
    WITHDRAWAL_DEADLINE_PASSED:
      "The withdrawal deadline has passed for this course",
    SECTION_NOT_FOUND: "The requested section was not found",
    STUDENT_NOT_FOUND: "Student record not found",
    MAX_CREDITS_EXCEEDED: "Adding this course would exceed your credit limit",
    CAPACITY_RESTRICTION:
      "You do not meet the enrollment restrictions for this section",

    // Transfer Credit
    DUPLICATE_TRANSFER_CREDIT: "This transfer credit already exists",
    INVALID_TRANSFER_INSTITUTION: "The transfer institution is not recognized",
    TRANSFER_CREDITS_EXCEED_LIMIT:
      "Transfer credits would exceed program limits",
    TRANSFER_CREDIT_NOT_FOUND: "Transfer credit record not found",
    TRANSFER_EVALUATION_PENDING: "Transfer credit evaluation is still pending",

    // Academic Standing
    STANDING_POLICY_NOT_FOUND: "Academic standing policy not found",
    STANDING_CALCULATION_FAILED: "Unable to calculate academic standing",
    INSUFFICIENT_CREDITS: "Insufficient credits for this operation",

    // Graduation
    GRADUATION_REQUIREMENTS_NOT_MET: "Graduation requirements have not been met",
    GRADUATION_APPLICATION_EXISTS:
      "A graduation application already exists for this program",
    GRADUATION_APPLICATION_NOT_FOUND: "Graduation application not found",
    GRADUATION_HOLD: "A hold is preventing graduation",
    DEGREE_ALREADY_CONFERRED: "This degree has already been conferred",

    // Financial
    INSUFFICIENT_BALANCE: "Insufficient account balance",
    PAYMENT_FAILED: "Payment could not be processed",
    ACCOUNT_NOT_FOUND: "Student account not found",
    FINANCIAL_HOLD: "A financial hold is on your account",

    // Authorization
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "You do not have permission to perform this action",
    FERPA_VIOLATION: "Access denied due to FERPA restrictions",

    // Generic
    NOT_FOUND: "The requested resource was not found",
    CONFLICT: "This operation conflicts with existing data",
    VALIDATION_FAILED: "Invalid input data",
    INTERNAL_ERROR: "An unexpected error occurred",
  };

  return messages[error.code] || `Error: ${error.code}`;
}

// =============================================================================
// Main Mapper Function
// =============================================================================

/**
 * Converts a typed API error to a TRPCError.
 *
 * The original error is preserved in the `cause` field, allowing frontend
 * code to access typed error data.
 *
 * @example
 * ```ts
 * // In router
 * if (!result.ok) {
 *   throw mapToTRPC(result.error);
 * }
 *
 * // On frontend
 * catch (e) {
 *   if (e.data?.cause?.code === "SECTION_FULL") {
 *     const err = e.data.cause;
 *     console.log(`Section ${err.sectionId} is full, waitlist: ${err.waitlistAvailable}`);
 *   }
 * }
 * ```
 */
export function mapToTRPC<E extends BaseApiError>(error: E): TRPCError {
  const trpcCode = ERROR_CODE_TO_TRPC[error.code] ?? "BAD_REQUEST";
  const message = formatErrorMessage(error);

  return new TRPCError({
    code: trpcCode,
    message,
    cause: error, // Preserve typed error for frontend
  });
}

/**
 * Convenience function to create and throw a TRPCError in one step.
 *
 * @example
 * ```ts
 * throwTRPC({ code: "SECTION_NOT_FOUND", sectionId: id });
 * ```
 */
export function throwTRPC<E extends BaseApiError>(error: E): never {
  throw mapToTRPC(error);
}

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * Factory functions for creating common errors with proper typing.
 */

export function sectionFullError(
  sectionId: string,
  currentEnrollment: number,
  capacity: number,
  waitlistAvailable: boolean,
  waitlistPosition?: number
): ApiError {
  return {
    code: "SECTION_FULL",
    sectionId,
    currentEnrollment,
    capacity,
    waitlistAvailable,
    waitlistPosition,
  };
}

export function prerequisiteNotMetError(
  courseId: string,
  missing: Array<{
    requisiteType: "prerequisite" | "corequisite";
    courseCode: string;
    courseName: string;
    description: string;
    canBeTakenConcurrently: boolean;
  }>
): ApiError {
  return {
    code: "PREREQUISITE_NOT_MET",
    courseId,
    missing,
  };
}

export function holdBlockingError(
  holds: Array<{
    holdId: string;
    holdCode: string;
    holdName: string;
    holdType: "financial" | "academic" | "administrative" | "disciplinary";
    releaseAuthority: string;
    resolutionInstructions?: string;
  }>
): ApiError {
  return {
    code: "HOLD_BLOCKING",
    holds,
  };
}

export function scheduleConflictError(
  requestedSectionId: string,
  conflicts: Array<{
    sectionId: string;
    courseCode: string;
    courseName: string;
    meetingDays: string;
    startTime: string;
    endTime: string;
    registrationId: string;
  }>
): ApiError {
  return {
    code: "SCHEDULE_CONFLICT",
    requestedSectionId,
    conflicts,
  };
}

export function notFoundError(entityType: string, entityId: string): ApiError {
  return {
    code: "NOT_FOUND",
    entityType,
    entityId,
    message: `${entityType} with ID ${entityId} not found`,
  };
}

export function forbiddenError(
  requiredRole?: string,
  requiredPermission?: string,
  resource?: string
): ApiError {
  return {
    code: "FORBIDDEN",
    requiredRole,
    requiredPermission,
    resource,
  };
}

export function validationError(
  fields: Record<string, { message: string; code: string }[]>
): ApiError {
  return {
    code: "VALIDATION_FAILED",
    fields,
  };
}

// =============================================================================
// Type-Safe Error Checking Utilities
// =============================================================================

/**
 * Type guard to check if an error cause has a specific code.
 *
 * @example
 * ```ts
 * try {
 *   await mutation.mutateAsync(data);
 * } catch (e) {
 *   if (hasErrorCode(e, "SECTION_FULL")) {
 *     // TypeScript knows e.data.cause is SectionFullError
 *   }
 * }
 * ```
 */
export function hasErrorCode<T extends ApiError["code"]>(
  error: unknown,
  code: T
): error is TRPCError & { cause: Extract<ApiError, { code: T }> } {
  if (!(error instanceof TRPCError)) return false;
  const cause = error.cause as BaseApiError | undefined;
  return cause?.code === code;
}

/**
 * Extract the typed error from a TRPCError if it matches the expected code.
 */
export function extractError<T extends ApiError["code"]>(
  error: unknown,
  code: T
): Extract<ApiError, { code: T }> | null {
  if (hasErrorCode(error, code)) {
    return error.cause as Extract<ApiError, { code: T }>;
  }
  return null;
}
