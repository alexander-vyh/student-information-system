/**
 * GPA Calculation Types
 *
 * Types for calculating Grade Point Average according to standard
 * higher education practices.
 */

/**
 * A single course attempt for GPA calculation
 */
export interface CourseAttempt {
  /** Unique identifier for this registration */
  registrationId: string;

  /** Course identifier for repeat detection */
  courseId: string;

  /** Credit hours attempted */
  credits: number;

  /** Grade points for this grade (e.g., 4.0 for A, 3.7 for A-) */
  gradePoints: number | null; // null = in progress or no grade

  /** Grade code (e.g., "A", "B+", "W") */
  gradeCode: string | null;

  /** Whether credits were earned (passed) */
  creditsEarned: boolean;

  /** Whether this counts in GPA calculation */
  includeInGpa: boolean;

  /** Term ID for term GPA calculation */
  termId: string;

  /** Whether this is a repeat of a previous attempt */
  isRepeat: boolean;

  /** If this is a repeat, the policy for handling it */
  repeatPolicy?: RepeatPolicy;

  /** If this is a repeat, the ID of the previous attempt being replaced */
  repeatsRegistrationId?: string;
}

/**
 * How repeated courses are handled
 */
export type RepeatPolicy = "replace" | "average" | "highest" | "all_count";

/**
 * Grade definition for the grade scale
 */
export interface GradeDefinition {
  gradeCode: string;
  gradePoints: number | null; // null for non-GPA grades
  countInGpa: boolean;
  earnedCredits: boolean;
  attemptedCredits: boolean;
  isIncomplete: boolean;
  isWithdrawal: boolean;
}

/**
 * Result of GPA calculation
 */
export interface GpaResult {
  /** Total credits attempted (includes failed courses) */
  attemptedCredits: number;

  /** Total credits earned (passed courses only) */
  earnedCredits: number;

  /** Total quality points (grade points × credits) */
  qualityPoints: number;

  /** Cumulative GPA (quality points / attempted credits for GPA courses) */
  cumulativeGpa: number | null; // null if no GPA-eligible credits

  /** GPA-eligible attempted credits (subset of attemptedCredits) */
  gpaCredits: number;

  /** Details for audit trail */
  details: GpaCalculationDetail[];
}

/**
 * Detail of how each course was counted in GPA
 */
export interface GpaCalculationDetail {
  registrationId: string;
  courseId: string;
  credits: number;
  gradeCode: string | null;
  gradePoints: number | null;
  qualityPoints: number;
  includedInGpa: boolean;
  excludedReason?: string;
}

/**
 * Options for GPA calculation
 */
export interface GpaCalculationOptions {
  /** How to handle repeated courses (default: replace) */
  defaultRepeatPolicy?: RepeatPolicy;

  /** Whether to round GPA (default: 3 decimal places) */
  decimalPlaces?: number;

  /** Grade scale to use */
  gradeScale?: GradeDefinition[];
}

/**
 * Term GPA result
 */
export interface TermGpaResult extends GpaResult {
  termId: string;
}
