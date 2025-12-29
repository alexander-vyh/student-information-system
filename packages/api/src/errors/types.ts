/**
 * Typed Domain Errors
 *
 * Operation-specific error types with rich context for frontend handling.
 * These complement the generic ErrorCode from @sis/domain with actionable data.
 *
 * Usage:
 *   import { EnrollmentError } from "../errors/types.js";
 *   const error: EnrollmentError = {
 *     code: "SECTION_FULL",
 *     sectionId: "abc-123",
 *     waitlistAvailable: true
 *   };
 *
 * Frontend can then:
 *   if (error.cause?.code === "SECTION_FULL" && error.cause.waitlistAvailable) {
 *     showWaitlistPrompt();
 *   }
 */

import type {
  StudentId,
  SectionId,
  CourseId,
  RegistrationId,
  HoldId,
  TermId,
  TransferCreditId,
  TransferInstitutionId,
  ProgramId,
  GraduationApplicationId,
} from "@sis/db/ids";

// =============================================================================
// Base Error Interface
// =============================================================================

/**
 * All API errors extend this base interface
 */
export interface BaseApiError {
  /** Stable error code for programmatic handling */
  code: string;
  /** Human-readable message (optional, can be generated from code) */
  message?: string;
}

// =============================================================================
// Enrollment Errors
// =============================================================================

/**
 * Errors that can occur during course enrollment operations.
 */
export type EnrollmentError =
  | SectionFullError
  | PrerequisiteNotMetError
  | HoldBlockingError
  | ScheduleConflictError
  | AlreadyEnrolledError
  | EnrollmentClosedError
  | DropDeadlinePassedError
  | WithdrawalDeadlinePassedError
  | SectionNotFoundError
  | StudentNotFoundError
  | MaxCreditsExceededError
  | CapacityRestrictionError;

export interface SectionFullError extends BaseApiError {
  code: "SECTION_FULL";
  sectionId: SectionId | string;
  currentEnrollment: number;
  capacity: number;
  waitlistAvailable: boolean;
  waitlistPosition?: number;
}

export interface PrerequisiteNotMetError extends BaseApiError {
  code: "PREREQUISITE_NOT_MET";
  courseId: CourseId | string;
  missing: Array<{
    requisiteType: "prerequisite" | "corequisite";
    courseCode: string;
    courseName: string;
    description: string;
    canBeTakenConcurrently: boolean;
  }>;
}

export interface HoldBlockingError extends BaseApiError {
  code: "HOLD_BLOCKING";
  holds: Array<{
    holdId: HoldId | string;
    holdCode: string;
    holdName: string;
    holdType: "financial" | "academic" | "administrative" | "disciplinary";
    releaseAuthority: string;
    resolutionInstructions?: string;
  }>;
}

export interface ScheduleConflictError extends BaseApiError {
  code: "SCHEDULE_CONFLICT";
  requestedSectionId: SectionId | string;
  conflicts: Array<{
    sectionId: SectionId | string;
    courseCode: string;
    courseName: string;
    meetingDays: string;
    startTime: string;
    endTime: string;
    registrationId: RegistrationId | string;
  }>;
}

export interface AlreadyEnrolledError extends BaseApiError {
  code: "ALREADY_ENROLLED";
  existingRegistrationId: RegistrationId | string;
  existingStatus: "registered" | "waitlisted" | "completed";
  courseCode: string;
  sectionNumber: string;
}

export interface EnrollmentClosedError extends BaseApiError {
  code: "ENROLLMENT_CLOSED";
  termId: TermId | string;
  enrollmentStart?: Date | string;
  enrollmentEnd?: Date | string;
  reason: "before_start" | "after_end" | "term_closed";
}

export interface DropDeadlinePassedError extends BaseApiError {
  code: "DROP_DEADLINE_PASSED";
  dropDeadline: Date | string;
  currentDate: Date | string;
  alternativeAction: "withdraw" | "appeal";
}

export interface WithdrawalDeadlinePassedError extends BaseApiError {
  code: "WITHDRAWAL_DEADLINE_PASSED";
  withdrawalDeadline: Date | string;
  currentDate: Date | string;
}

export interface SectionNotFoundError extends BaseApiError {
  code: "SECTION_NOT_FOUND";
  sectionId: SectionId | string;
}

export interface StudentNotFoundError extends BaseApiError {
  code: "STUDENT_NOT_FOUND";
  studentId: StudentId | string;
}

export interface MaxCreditsExceededError extends BaseApiError {
  code: "MAX_CREDITS_EXCEEDED";
  currentCredits: number;
  requestedCredits: number;
  maxCredits: number;
  requiresOverrideApproval: boolean;
}

export interface CapacityRestrictionError extends BaseApiError {
  code: "CAPACITY_RESTRICTION";
  sectionId: SectionId | string;
  restrictionType: "major_only" | "level_only" | "cohort_only" | "permission";
  restrictionDetails: string;
}

// =============================================================================
// Transfer Credit Errors
// =============================================================================

/**
 * Errors that can occur during transfer credit operations.
 */
export type TransferCreditError =
  | DuplicateTransferCreditError
  | InvalidTransferInstitutionError
  | TransferCreditsExceedLimitError
  | TransferCreditNotFoundError
  | TransferEvaluationPendingError;

export interface DuplicateTransferCreditError extends BaseApiError {
  code: "DUPLICATE_TRANSFER_CREDIT";
  existingId: TransferCreditId | string;
  sourceCourseCode: string;
  sourceInstitution: string;
}

export interface InvalidTransferInstitutionError extends BaseApiError {
  code: "INVALID_TRANSFER_INSTITUTION";
  institutionId: TransferInstitutionId | string;
  reason: "not_accredited" | "not_recognized" | "inactive";
}

export interface TransferCreditsExceedLimitError extends BaseApiError {
  code: "TRANSFER_CREDITS_EXCEED_LIMIT";
  currentTransferCredits: number;
  requestedCredits: number;
  maxTransferCredits: number;
  programId: ProgramId | string;
}

export interface TransferCreditNotFoundError extends BaseApiError {
  code: "TRANSFER_CREDIT_NOT_FOUND";
  transferCreditId: TransferCreditId | string;
}

export interface TransferEvaluationPendingError extends BaseApiError {
  code: "TRANSFER_EVALUATION_PENDING";
  transferCreditId: TransferCreditId | string;
  submittedAt: Date | string;
  estimatedCompletionDate?: Date | string;
}

// =============================================================================
// Academic Standing Errors
// =============================================================================

/**
 * Errors that can occur during academic standing operations.
 */
export type AcademicStandingError =
  | StandingPolicyNotFoundError
  | StandingCalculationFailedError
  | InsufficientCreditsError;

export interface StandingPolicyNotFoundError extends BaseApiError {
  code: "STANDING_POLICY_NOT_FOUND";
  policyCode?: string;
  programId?: ProgramId | string;
}

export interface StandingCalculationFailedError extends BaseApiError {
  code: "STANDING_CALCULATION_FAILED";
  reason: string;
  missingData?: string[];
}

export interface InsufficientCreditsError extends BaseApiError {
  code: "INSUFFICIENT_CREDITS";
  currentCredits: number;
  requiredCredits: number;
  operation: string;
}

// =============================================================================
// Graduation Errors
// =============================================================================

/**
 * Errors that can occur during graduation operations.
 */
export type GraduationError =
  | GraduationRequirementsNotMetError
  | GraduationApplicationExistsError
  | GraduationApplicationNotFoundError
  | GraduationHoldError
  | DegreeAlreadyConferredError;

export interface GraduationRequirementsNotMetError extends BaseApiError {
  code: "GRADUATION_REQUIREMENTS_NOT_MET";
  completionPercentage: number;
  blockers: string[];
  missingRequirements: Array<{
    requirementId: string;
    requirementName: string;
    creditsNeeded: number;
    coursesNeeded: number;
  }>;
}

export interface GraduationApplicationExistsError extends BaseApiError {
  code: "GRADUATION_APPLICATION_EXISTS";
  existingApplicationId: GraduationApplicationId | string;
  existingStatus: string;
  applicationDate: Date | string;
}

export interface GraduationApplicationNotFoundError extends BaseApiError {
  code: "GRADUATION_APPLICATION_NOT_FOUND";
  applicationId: GraduationApplicationId | string;
}

export interface GraduationHoldError extends BaseApiError {
  code: "GRADUATION_HOLD";
  holds: Array<{
    holdCode: string;
    holdName: string;
    releaseAuthority: string;
  }>;
}

export interface DegreeAlreadyConferredError extends BaseApiError {
  code: "DEGREE_ALREADY_CONFERRED";
  conferralDate: Date | string;
  degreeType: string;
}

// =============================================================================
// Financial Errors
// =============================================================================

/**
 * Errors that can occur during financial operations.
 */
export type FinancialError =
  | InsufficientBalanceError
  | PaymentFailedError
  | AccountNotFoundError
  | FinancialHoldError;

export interface InsufficientBalanceError extends BaseApiError {
  code: "INSUFFICIENT_BALANCE";
  currentBalance: number;
  requiredAmount: number;
  currency: string;
}

export interface PaymentFailedError extends BaseApiError {
  code: "PAYMENT_FAILED";
  reason: "declined" | "expired" | "invalid" | "fraud" | "unknown";
  processorMessage?: string;
  retryable: boolean;
}

export interface AccountNotFoundError extends BaseApiError {
  code: "ACCOUNT_NOT_FOUND";
  studentId: StudentId | string;
}

export interface FinancialHoldError extends BaseApiError {
  code: "FINANCIAL_HOLD";
  outstandingBalance: number;
  minimumPaymentRequired: number;
  holdType: string;
}

// =============================================================================
// Authorization Errors
// =============================================================================

/**
 * Errors related to authorization and access control.
 */
export type AuthorizationError =
  | UnauthorizedError
  | ForbiddenError
  | FerpaViolationError;

export interface UnauthorizedError extends BaseApiError {
  code: "UNAUTHORIZED";
  reason: "no_session" | "expired_session" | "invalid_token";
}

export interface ForbiddenError extends BaseApiError {
  code: "FORBIDDEN";
  requiredRole?: string;
  requiredPermission?: string;
  resource?: string;
}

export interface FerpaViolationError extends BaseApiError {
  code: "FERPA_VIOLATION";
  accessedStudentId: StudentId | string;
  requiredRelationship: string;
}

// =============================================================================
// Generic Errors
// =============================================================================

/**
 * Generic errors for common scenarios.
 */
export type GenericError =
  | NotFoundError
  | ConflictError
  | ValidationError
  | InternalError;

export interface NotFoundError extends BaseApiError {
  code: "NOT_FOUND";
  entityType: string;
  entityId: string;
}

export interface ConflictError extends BaseApiError {
  code: "CONFLICT";
  conflictType: string;
  existingValue?: unknown;
}

export interface ValidationError extends BaseApiError {
  code: "VALIDATION_FAILED";
  fields: Record<
    string,
    {
      message: string;
      code: string;
    }[]
  >;
}

export interface InternalError extends BaseApiError {
  code: "INTERNAL_ERROR";
  requestId?: string;
}

// =============================================================================
// Union of All API Errors
// =============================================================================

/**
 * All possible API errors.
 * Useful for generic error handling.
 */
export type ApiError =
  | EnrollmentError
  | TransferCreditError
  | AcademicStandingError
  | GraduationError
  | FinancialError
  | AuthorizationError
  | GenericError;

// =============================================================================
// Error Code Constants
// =============================================================================

/**
 * All error codes for reference.
 * Can be used for exhaustive switch statements.
 */
export const ERROR_CODES = {
  // Enrollment
  SECTION_FULL: "SECTION_FULL",
  PREREQUISITE_NOT_MET: "PREREQUISITE_NOT_MET",
  HOLD_BLOCKING: "HOLD_BLOCKING",
  SCHEDULE_CONFLICT: "SCHEDULE_CONFLICT",
  ALREADY_ENROLLED: "ALREADY_ENROLLED",
  ENROLLMENT_CLOSED: "ENROLLMENT_CLOSED",
  DROP_DEADLINE_PASSED: "DROP_DEADLINE_PASSED",
  WITHDRAWAL_DEADLINE_PASSED: "WITHDRAWAL_DEADLINE_PASSED",
  SECTION_NOT_FOUND: "SECTION_NOT_FOUND",
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  MAX_CREDITS_EXCEEDED: "MAX_CREDITS_EXCEEDED",
  CAPACITY_RESTRICTION: "CAPACITY_RESTRICTION",

  // Transfer Credit
  DUPLICATE_TRANSFER_CREDIT: "DUPLICATE_TRANSFER_CREDIT",
  INVALID_TRANSFER_INSTITUTION: "INVALID_TRANSFER_INSTITUTION",
  TRANSFER_CREDITS_EXCEED_LIMIT: "TRANSFER_CREDITS_EXCEED_LIMIT",
  TRANSFER_CREDIT_NOT_FOUND: "TRANSFER_CREDIT_NOT_FOUND",
  TRANSFER_EVALUATION_PENDING: "TRANSFER_EVALUATION_PENDING",

  // Academic Standing
  STANDING_POLICY_NOT_FOUND: "STANDING_POLICY_NOT_FOUND",
  STANDING_CALCULATION_FAILED: "STANDING_CALCULATION_FAILED",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",

  // Graduation
  GRADUATION_REQUIREMENTS_NOT_MET: "GRADUATION_REQUIREMENTS_NOT_MET",
  GRADUATION_APPLICATION_EXISTS: "GRADUATION_APPLICATION_EXISTS",
  GRADUATION_APPLICATION_NOT_FOUND: "GRADUATION_APPLICATION_NOT_FOUND",
  GRADUATION_HOLD: "GRADUATION_HOLD",
  DEGREE_ALREADY_CONFERRED: "DEGREE_ALREADY_CONFERRED",

  // Financial
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  FINANCIAL_HOLD: "FINANCIAL_HOLD",

  // Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  FERPA_VIOLATION: "FERPA_VIOLATION",

  // Generic
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeType = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
