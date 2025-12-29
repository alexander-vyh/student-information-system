/**
 * Query Helpers Module
 *
 * Reusable database queries organized by domain.
 * Import from "@sis/db/queries" in the API layer.
 */

// Student queries
export {
  getStudentWithProgramAndGpa,
  getGpaSummary,
  getPrimaryProgram,
  getAllStudentPrograms,
} from "./student.js";

// Enrollment queries
export {
  getRegistrationsWithDetails,
  getTermRegistrations,
  getCompletedRegistrations,
  getIncompleteGradeRegistrations,
  getPendingGradeRegistrations,
  getExistingRegistration,
  type RegistrationQueryOptions,
} from "./enrollment.js";

// Hold queries
export {
  getActiveHolds,
  getRegistrationBlockingHolds,
  getGraduationBlockingHolds,
  getTranscriptBlockingHolds,
  getBlockingHolds,
  type HoldBlockType,
} from "./holds.js";
