/**
 * Result Type - Explicit Error Handling
 *
 * A discriminated union for representing success/failure outcomes.
 * Eliminates exception-based control flow in business logic.
 *
 * Design Rationale:
 * - Explicit: Callers must handle both success and failure cases
 * - Composable: Chain operations with map/flatMap
 * - Debuggable: Error context preserved through the call chain
 * - Type-safe: TypeScript enforces exhaustive handling
 *
 * Alternative Considered: throw/catch pattern
 * - Rejected because: Hidden control flow, easy to miss error cases,
 *   poor stack traces in async code, harder to test
 */

/**
 * Success result
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failure result with typed error
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok<T> or Err<E>
 */
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

/**
 * Create a success result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failure result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard for success
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard for failure
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwrap a result, throwing if it's an error
 * Use sparingly - prefer pattern matching
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap with default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Map over success value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over error
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain results (flatMap/bind)
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Combine multiple results into a single result
 * If any result is an error, returns the first error
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Collect all results, separating successes and failures
 * Useful for batch processing where you want all errors
 */
export function partition<T, E>(
  results: Result<T, E>[]
): { successes: T[]; failures: E[] } {
  const successes: T[] = [];
  const failures: E[] = [];

  for (const result of results) {
    if (isOk(result)) {
      successes.push(result.value);
    } else {
      failures.push(result.error);
    }
  }

  return { successes, failures };
}

/**
 * Convert a promise to a Result
 * Catches exceptions and wraps in Err
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  mapError: (e: unknown) => E = (e) => e as E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(mapError(e));
  }
}

/**
 * Convert a throwing function to a Result-returning function
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError: (e: unknown) => E = (e) => e as E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(mapError(e));
  }
}

// ============================================================================
// Domain Error Types
// ============================================================================

/**
 * Base domain error with code and context
 *
 * Design: Use error codes instead of error classes for serialization
 * and pattern matching. Codes are stable identifiers; messages are
 * human-readable and may change.
 */
export interface DomainError {
  /** Stable error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable message */
  message: string;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
  /** Original error if wrapping */
  cause?: unknown;
}

/**
 * Error codes for the domain layer
 *
 * Naming convention: DOMAIN_ACTION_REASON
 * - All caps with underscores
 * - Grouped by domain
 */
export type ErrorCode =
  // Validation errors
  | "VALIDATION_FAILED"
  | "INVALID_INPUT"
  | "MISSING_REQUIRED_FIELD"
  // Student errors
  | "STUDENT_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "STUDENT_HOLD_EXISTS"
  // Enrollment errors
  | "ENROLLMENT_NOT_FOUND"
  | "ENROLLMENT_CLOSED"
  | "SECTION_FULL"
  | "SECTION_NOT_FOUND"
  | "PREREQUISITE_NOT_MET"
  | "DUPLICATE_ENROLLMENT"
  | "DROP_DEADLINE_PASSED"
  | "WITHDRAWAL_DEADLINE_PASSED"
  // Financial errors
  | "ACCOUNT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "HOLD_PREVENTS_ACTION"
  | "INVALID_PAYMENT"
  // Financial Aid errors
  | "ISIR_NOT_FOUND"
  | "SAP_INELIGIBLE"
  | "AWARD_EXCEEDS_COA"
  | "DISBURSEMENT_FAILED"
  // GPA errors
  | "GPA_CALCULATION_FAILED"
  | "NO_GRADED_COURSES"
  // SAP errors
  | "SAP_CALCULATION_FAILED"
  | "SAP_DATA_INCOMPLETE"
  // R2T4 errors
  | "R2T4_CALCULATION_FAILED"
  | "R2T4_NOT_APPLICABLE"
  // Authorization errors
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "FERPA_VIOLATION"
  // System errors
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "INTERNAL_ERROR";

/**
 * Create a domain error
 */
export function domainError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
  cause?: unknown
): DomainError {
  return { code, message, context, cause };
}

/**
 * Type guard for domain errors
 */
export function isDomainError(value: unknown): value is DomainError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validation error with field-level details
 */
export interface ValidationError extends DomainError {
  code: "VALIDATION_FAILED";
  fields: Record<string, string[]>;
}

/**
 * Create a validation error
 */
export function validationError(
  fields: Record<string, string[]>,
  message = "Validation failed"
): ValidationError {
  return {
    code: "VALIDATION_FAILED",
    message,
    fields,
  };
}

/**
 * Validate a value with a predicate
 */
export function validate<T>(
  value: T,
  predicate: (v: T) => boolean,
  error: DomainError
): Result<T, DomainError> {
  if (predicate(value)) {
    return ok(value);
  }
  return err(error);
}

/**
 * Ensure a value is not null/undefined
 */
export function ensureExists<T>(
  value: T | null | undefined,
  error: DomainError
): Result<T, DomainError> {
  if (value !== null && value !== undefined) {
    return ok(value);
  }
  return err(error);
}
