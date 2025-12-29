/**
 * Mappers Module
 *
 * Transform database types to domain types.
 * Centralizes parsing and type conversions.
 *
 * Usage:
 *   import { parseDecimal, toGpaSummary, toStudentCourses } from "../mappers/index.js";
 *
 *   const gpaSummary = toGpaSummary(dbSummary);
 *   const courses = toStudentCourses(registrations, transfers, tests);
 */

// Type utilities
export {
  parseDecimal,
  parseDecimalFixed,
  parseInteger,
  toISOString,
  toDateString,
  withDefault,
  mapOptional,
} from "./types.js";

// GPA mappers
export {
  toGpaSummary,
  toGpaSummaryOrNull,
  toTermGpa,
  toAcademicStandingInput,
  type DbGpaSummary,
  type GpaSummary,
  type DbTermGpa,
  type TermGpa,
  type AcademicStandingInput,
} from "./gpa.js";

// Course mappers
export {
  registrationToStudentCourse,
  transferCreditToStudentCourse,
  testCreditToStudentCourse,
  toStudentCourses,
  getCompletedCourses,
  getCoursesBySubject,
  getTotalCredits,
  type StudentCourse,
  type DbRegistrationWithDetails,
  type DbTransferCredit,
  type DbTestCredit,
} from "./courses.js";
