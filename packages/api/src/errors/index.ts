/**
 * API Errors Module
 *
 * Typed domain errors with TRPCError mapping.
 *
 * Usage:
 *   import { mapToTRPC, EnrollmentError, sectionFullError } from "./errors/index.js";
 *
 *   // Create and throw typed error
 *   throw mapToTRPC(sectionFullError("sec-123", 30, 30, true));
 *
 *   // Or use error type directly
 *   const error: EnrollmentError = {
 *     code: "SECTION_FULL",
 *     sectionId: "sec-123",
 *     currentEnrollment: 30,
 *     capacity: 30,
 *     waitlistAvailable: true
 *   };
 *   throw mapToTRPC(error);
 */

// Error types
export type {
  // Base
  BaseApiError,
  ApiError,
  ErrorCodeType,

  // Enrollment
  EnrollmentError,
  SectionFullError,
  PrerequisiteNotMetError,
  HoldBlockingError,
  ScheduleConflictError,
  AlreadyEnrolledError,
  EnrollmentClosedError,
  DropDeadlinePassedError,
  WithdrawalDeadlinePassedError,
  SectionNotFoundError,
  StudentNotFoundError,
  MaxCreditsExceededError,
  CapacityRestrictionError,

  // Transfer Credit
  TransferCreditError,
  DuplicateTransferCreditError,
  InvalidTransferInstitutionError,
  TransferCreditsExceedLimitError,
  TransferCreditNotFoundError,
  TransferEvaluationPendingError,

  // Academic Standing
  AcademicStandingError,
  StandingPolicyNotFoundError,
  StandingCalculationFailedError,
  InsufficientCreditsError,

  // Graduation
  GraduationError,
  GraduationRequirementsNotMetError,
  GraduationApplicationExistsError,
  GraduationApplicationNotFoundError,
  GraduationHoldError,
  DegreeAlreadyConferredError,

  // Financial
  FinancialError,
  InsufficientBalanceError,
  PaymentFailedError,
  AccountNotFoundError,
  FinancialHoldError,

  // Authorization
  AuthorizationError,
  UnauthorizedError,
  ForbiddenError,
  FerpaViolationError,

  // Generic
  GenericError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
} from "./types.js";

// Error code constants
export { ERROR_CODES } from "./types.js";

// Mapper functions
export {
  mapToTRPC,
  throwTRPC,
  formatErrorMessage,
  hasErrorCode,
  extractError,
} from "./mapper.js";

// Error factory functions
export {
  sectionFullError,
  prerequisiteNotMetError,
  holdBlockingError,
  scheduleConflictError,
  notFoundError,
  forbiddenError,
  validationError,
} from "./mapper.js";
