/**
 * GPA Mappers
 *
 * Transform database GPA records to domain types.
 * Centralizes decimal parsing for GPA-related fields.
 */

import { parseDecimalFixed, parseInteger } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Database GPA summary row (from student_gpa_summary table).
 * Fields come back as strings from Drizzle for decimal columns.
 */
export interface DbGpaSummary {
  id: string;
  studentId: string;
  cumulativeGpa: string | null;
  cumulativeCreditsAttempted: string | null;
  cumulativeCreditsEarned: string | null;
  cumulativeQualityPoints: string | null;
  institutionalGpa: string | null;
  institutionalCreditsAttempted: string | null;
  institutionalCreditsEarned: string | null;
  lastCalculatedAt: Date | null;
}

/**
 * Parsed GPA summary for domain use.
 * All numeric fields are actual numbers.
 */
export interface GpaSummary {
  id: string;
  studentId: string;
  cumulativeGpa: number;
  cumulativeCreditsAttempted: number;
  cumulativeCreditsEarned: number;
  cumulativeQualityPoints: number;
  institutionalGpa: number;
  institutionalCreditsAttempted: number;
  institutionalCreditsEarned: number;
  lastCalculatedAt: Date | null;
}

// =============================================================================
// Mappers
// =============================================================================

/**
 * Transform a database GPA summary to domain type.
 * Parses all decimal strings to numbers.
 *
 * @example
 * const dbSummary = await db.query.studentGpaSummary.findFirst({...});
 * const summary = toGpaSummary(dbSummary);
 * console.log(summary.cumulativeGpa); // 3.45 (number, not "3.45")
 */
export function toGpaSummary(dbSummary: DbGpaSummary): GpaSummary {
  return {
    id: dbSummary.id,
    studentId: dbSummary.studentId,
    cumulativeGpa: parseDecimalFixed(dbSummary.cumulativeGpa, 3),
    cumulativeCreditsAttempted: parseDecimalFixed(
      dbSummary.cumulativeCreditsAttempted,
      1
    ),
    cumulativeCreditsEarned: parseDecimalFixed(
      dbSummary.cumulativeCreditsEarned,
      1
    ),
    cumulativeQualityPoints: parseDecimalFixed(
      dbSummary.cumulativeQualityPoints,
      2
    ),
    institutionalGpa: parseDecimalFixed(dbSummary.institutionalGpa, 3),
    institutionalCreditsAttempted: parseDecimalFixed(
      dbSummary.institutionalCreditsAttempted,
      1
    ),
    institutionalCreditsEarned: parseDecimalFixed(
      dbSummary.institutionalCreditsEarned,
      1
    ),
    lastCalculatedAt: dbSummary.lastCalculatedAt,
  };
}

/**
 * Transform a nullable GPA summary.
 */
export function toGpaSummaryOrNull(
  dbSummary: DbGpaSummary | null | undefined
): GpaSummary | null {
  if (!dbSummary) return null;
  return toGpaSummary(dbSummary);
}

// =============================================================================
// Term GPA Types & Mappers
// =============================================================================

export interface DbTermGpa {
  termId: string;
  termGpa: string | null;
  termCreditsAttempted: string | null;
  termCreditsEarned: string | null;
  termQualityPoints: string | null;
}

export interface TermGpa {
  termId: string;
  termGpa: number;
  termCreditsAttempted: number;
  termCreditsEarned: number;
  termQualityPoints: number;
}

export function toTermGpa(dbTermGpa: DbTermGpa): TermGpa {
  return {
    termId: dbTermGpa.termId,
    termGpa: parseDecimalFixed(dbTermGpa.termGpa, 3),
    termCreditsAttempted: parseDecimalFixed(dbTermGpa.termCreditsAttempted, 1),
    termCreditsEarned: parseDecimalFixed(dbTermGpa.termCreditsEarned, 1),
    termQualityPoints: parseDecimalFixed(dbTermGpa.termQualityPoints, 2),
  };
}

// =============================================================================
// Academic Standing Input Mapper
// =============================================================================

/**
 * Build input for academic standing calculation from DB data.
 * Used in: academic-standing router
 */
export interface AcademicStandingInput {
  cumulativeGpa: number;
  cumulativeCreditsAttempted: number;
  cumulativeCreditsEarned: number;
  termGpa: number;
  termCreditsAttempted: number;
  termCreditsEarned: number;
  currentStanding: string | null;
  programType: string;
}

export function toAcademicStandingInput(
  gpaSummary: GpaSummary | null,
  termGpa: TermGpa | null,
  currentStanding: string | null,
  programType: string
): AcademicStandingInput {
  return {
    cumulativeGpa: gpaSummary?.cumulativeGpa ?? 0,
    cumulativeCreditsAttempted: gpaSummary?.cumulativeCreditsAttempted ?? 0,
    cumulativeCreditsEarned: gpaSummary?.cumulativeCreditsEarned ?? 0,
    termGpa: termGpa?.termGpa ?? 0,
    termCreditsAttempted: termGpa?.termCreditsAttempted ?? 0,
    termCreditsEarned: termGpa?.termCreditsEarned ?? 0,
    currentStanding,
    programType,
  };
}
