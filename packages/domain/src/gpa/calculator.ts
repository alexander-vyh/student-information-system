/**
 * GPA Calculator
 *
 * Pure TypeScript implementation of GPA calculation logic.
 * No database dependencies - fully testable with unit tests.
 */

import type {
  CourseAttempt,
  GpaResult,
  GpaCalculationDetail,
  GpaCalculationOptions,
  RepeatPolicy,
  TermGpaResult,
} from "./types.js";

/**
 * Calculate GPA from a list of course attempts
 *
 * @param attempts - List of course attempts to include
 * @param options - Calculation options
 * @returns GPA calculation result
 */
export function calculateGpa(
  attempts: CourseAttempt[],
  options: GpaCalculationOptions = {}
): GpaResult {
  const { defaultRepeatPolicy = "replace", decimalPlaces = 3 } = options;

  // Handle repeat policy - determine which attempts to include
  const processedAttempts = applyRepeatPolicy(attempts, defaultRepeatPolicy);

  // Calculate totals
  let attemptedCredits = 0;
  let earnedCredits = 0;
  let qualityPoints = 0;
  let gpaCredits = 0;

  const details: GpaCalculationDetail[] = [];

  for (const attempt of processedAttempts) {
    const detail: GpaCalculationDetail = {
      registrationId: attempt.registrationId,
      courseId: attempt.courseId,
      credits: attempt.credits,
      gradeCode: attempt.gradeCode,
      gradePoints: attempt.gradePoints,
      qualityPoints: 0,
      includedInGpa: false,
    };

    // Skip if excluded from this calculation
    if (attempt.excluded) {
      detail.excludedReason = attempt.excludedReason;
      details.push(detail);
      continue;
    }

    // Count attempted credits (if grade was assigned)
    if (attempt.gradeCode !== null) {
      attemptedCredits += attempt.credits;
    }

    // Count earned credits (if passed)
    if (attempt.creditsEarned) {
      earnedCredits += attempt.credits;
    }

    // Calculate quality points (if included in GPA)
    if (attempt.includeInGpa && attempt.gradePoints !== null) {
      const attemptQualityPoints = attempt.credits * attempt.gradePoints;
      qualityPoints += attemptQualityPoints;
      gpaCredits += attempt.credits;

      detail.qualityPoints = attemptQualityPoints;
      detail.includedInGpa = true;
    }

    details.push(detail);
  }

  // Calculate GPA
  const cumulativeGpa =
    gpaCredits > 0
      ? roundToDecimalPlaces(qualityPoints / gpaCredits, decimalPlaces)
      : null;

  return {
    attemptedCredits,
    earnedCredits,
    qualityPoints: roundToDecimalPlaces(qualityPoints, decimalPlaces),
    cumulativeGpa,
    gpaCredits,
    details,
  };
}

/**
 * Calculate GPA for a specific term
 */
export function calculateTermGpa(
  attempts: CourseAttempt[],
  termId: string,
  options: GpaCalculationOptions = {}
): TermGpaResult {
  const termAttempts = attempts.filter((a) => a.termId === termId);
  const result = calculateGpa(termAttempts, options);

  return {
    ...result,
    termId,
  };
}

/**
 * Calculate GPA for multiple terms
 */
export function calculateGpaByTerm(
  attempts: CourseAttempt[],
  options: GpaCalculationOptions = {}
): Map<string, TermGpaResult> {
  // Group by term
  const termMap = new Map<string, CourseAttempt[]>();
  for (const attempt of attempts) {
    const existing = termMap.get(attempt.termId) ?? [];
    existing.push(attempt);
    termMap.set(attempt.termId, existing);
  }

  // Calculate GPA for each term
  const results = new Map<string, TermGpaResult>();
  for (const [termId, termAttempts] of termMap) {
    results.set(termId, calculateTermGpa(termAttempts, termId, options));
  }

  return results;
}

// Internal types for processing
interface ProcessedAttempt extends CourseAttempt {
  excluded: boolean;
  excludedReason?: string;
}

/**
 * Apply repeat policy to determine which attempts to count
 */
function applyRepeatPolicy(
  attempts: CourseAttempt[],
  defaultPolicy: RepeatPolicy
): ProcessedAttempt[] {
  // Group attempts by course
  const courseMap = new Map<string, CourseAttempt[]>();
  for (const attempt of attempts) {
    const existing = courseMap.get(attempt.courseId) ?? [];
    existing.push(attempt);
    courseMap.set(attempt.courseId, existing);
  }

  const processed: ProcessedAttempt[] = [];

  for (const [courseId, courseAttempts] of courseMap) {
    if (courseAttempts.length === 1 && courseAttempts[0]) {
      // No repeats - include as-is
      processed.push({ ...courseAttempts[0], excluded: false });
      continue;
    }

    // Multiple attempts - apply repeat policy
    const firstAttempt = courseAttempts[0];
    if (!firstAttempt) continue;

    const policy = firstAttempt.repeatPolicy ?? defaultPolicy;

    switch (policy) {
      case "replace":
        // Only count the most recent attempt with a grade
        const gradedAttempts = courseAttempts.filter((a) => a.gradeCode !== null);
        const mostRecent = gradedAttempts[gradedAttempts.length - 1] ?? null;

        for (const attempt of courseAttempts) {
          if (mostRecent && attempt === mostRecent) {
            processed.push({ ...attempt, excluded: false });
          } else {
            processed.push({
              ...attempt,
              excluded: true,
              excludedReason: "Excluded by repeat policy (replace)",
            });
          }
        }
        break;

      case "highest":
        // Only count the attempt with the highest grade
        let highest: CourseAttempt | null = firstAttempt;
        for (const attempt of courseAttempts) {
          if (highest && (attempt.gradePoints ?? -1) > (highest.gradePoints ?? -1)) {
            highest = attempt;
          }
        }

        for (const attempt of courseAttempts) {
          if (attempt === highest) {
            processed.push({ ...attempt, excluded: false });
          } else {
            processed.push({
              ...attempt,
              excluded: true,
              excludedReason: "Excluded by repeat policy (highest)",
            });
          }
        }
        break;

      case "average":
        // All attempts count - calculate average grade points
        // (Simplified: just include all; averaging would need to happen at grade level)
        for (const attempt of courseAttempts) {
          processed.push({ ...attempt, excluded: false });
        }
        break;

      case "all_count":
        // All attempts count separately
        for (const attempt of courseAttempts) {
          processed.push({ ...attempt, excluded: false });
        }
        break;

      default:
        // Default to including all
        for (const attempt of courseAttempts) {
          processed.push({ ...attempt, excluded: false });
        }
    }
  }

  return processed;
}

/**
 * Round a number to a specific number of decimal places
 */
function roundToDecimalPlaces(value: number, places: number): number {
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculate cumulative GPA including transfer credits
 */
export function calculateCumulativeGpaWithTransfer(
  institutionalAttempts: CourseAttempt[],
  transferQualityPoints: number,
  transferGpaCredits: number,
  options: GpaCalculationOptions = {}
): GpaResult {
  const institutionalResult = calculateGpa(institutionalAttempts, options);
  const { decimalPlaces = 3 } = options;

  // Combine institutional and transfer
  const totalQualityPoints =
    institutionalResult.qualityPoints + transferQualityPoints;
  const totalGpaCredits = institutionalResult.gpaCredits + transferGpaCredits;

  const cumulativeGpa =
    totalGpaCredits > 0
      ? roundToDecimalPlaces(totalQualityPoints / totalGpaCredits, decimalPlaces)
      : null;

  return {
    ...institutionalResult,
    qualityPoints: roundToDecimalPlaces(totalQualityPoints, decimalPlaces),
    gpaCredits: totalGpaCredits,
    cumulativeGpa,
  };
}
