/**
 * GPA Batch Calculation Job
 *
 * Recalculates GPA for students after grade changes.
 * Updates both term GPA and cumulative GPA.
 *
 * Processing Flow:
 * 1. Query students with grades in the specified term
 * 2. For each student, gather all course attempts
 * 3. Calculate term and cumulative GPA using domain calculator
 * 4. Update gpa_summary table with results
 */

import { Job } from "bullmq";
import { db } from "@sis/db";
import { sql } from "drizzle-orm";
import {
  calculateGpa,
  calculateTermGpa,
  ok,
  err,
  type Result,
  type DomainError,
  domainError,
} from "@sis/domain";
import type { CourseAttempt, GpaCalculationOptions } from "@sis/domain";
import { createJobLogger } from "../logger.js";
import { config } from "../config.js";
import type {
  GpaBatchJobData,
  GpaBatchJobResult,
  BatchProgress,
} from "./types.js";

/** GPA calculation options */
const GPA_OPTIONS: GpaCalculationOptions = {
  defaultRepeatPolicy: "replace",
  decimalPlaces: 3,
};

/**
 * Process GPA batch calculation
 */
export async function processGpaBatchJob(
  job: Job<GpaBatchJobData>
): Promise<Result<GpaBatchJobResult, DomainError>> {
  const log = createJobLogger("gpa-calculation", job.id ?? "unknown");
  const startTime = Date.now();
  const { termId, studentIds, batchId, calculateCumulative } = job.data;

  log.info(
    { termId, batchId, studentCount: studentIds?.length ?? "all" },
    "Starting GPA batch calculation"
  );

  const progress: BatchProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
  };

  const errors: GpaBatchJobResult["errors"] = [];

  try {
    // Get students to process
    const students = await getStudentsForGpaCalculation(termId, studentIds);
    progress.total = students.length;

    log.info({ total: progress.total }, "Found students to process");

    // Process in batches
    const batchSize = config.BATCH_SIZE_GPA;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);

      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map((student) =>
          calculateAndStoreGpaForStudent(student.id, termId, calculateCumulative)
        )
      );

      // Tally results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const batchStudent = batch[j];
        progress.processed++;

        if (!result || !batchStudent) continue;

        if (result.status === "fulfilled" && result.value.ok) {
          progress.successful++;
        } else {
          progress.failed++;
          const errorMsg =
            result.status === "rejected"
              ? String(result.reason)
              : result.status === "fulfilled" && !result.value.ok
                ? result.value.error.message
                : "Unknown error";
          errors.push({ studentId: batchStudent.id, error: errorMsg });
        }
      }

      // Update job progress
      await job.updateProgress(
        Math.round((progress.processed / progress.total) * 100)
      );

      log.debug(
        { processed: progress.processed, total: progress.total },
        "Batch progress"
      );
    }

    const durationMs = Date.now() - startTime;

    const result: GpaBatchJobResult = {
      batchId,
      termId,
      processed: progress.processed,
      successful: progress.successful,
      failed: progress.failed,
      skipped: progress.total - progress.processed,
      durationMs,
      errors: errors.slice(0, 100), // Limit error list
    };

    log.info(
      {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        durationMs,
      },
      "GPA batch calculation completed"
    );

    return ok(result);
  } catch (error) {
    log.error({ err: error }, "GPA batch calculation failed");
    return err(
      domainError(
        "GPA_CALCULATION_FAILED",
        `Batch GPA calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { batchId, termId }
      )
    );
  }
}

/**
 * Get students with grades in the specified term
 */
async function getStudentsForGpaCalculation(
  termId: string,
  specificIds?: string[]
): Promise<Array<{ id: string }>> {
  // Use Drizzle's sql tagged template
  const query = specificIds?.length
    ? sql`
        SELECT DISTINCT s.id
        FROM student.students s
        INNER JOIN enrollment.registrations r ON r.student_id = s.id
        WHERE r.term_id = ${termId}
          AND r.grade_code IS NOT NULL
          AND s.status = 'active'
          AND s.id = ANY(${specificIds})
        ORDER BY s.id
      `
    : sql`
        SELECT DISTINCT s.id
        FROM student.students s
        INNER JOIN enrollment.registrations r ON r.student_id = s.id
        WHERE r.term_id = ${termId}
          AND r.grade_code IS NOT NULL
          AND s.status = 'active'
        ORDER BY s.id
      `;

  const result = await db.execute(query);
  return (result as unknown as Array<{ id: string }>);
}

/**
 * Calculate and store GPA for a single student
 */
async function calculateAndStoreGpaForStudent(
  studentId: string,
  termId: string,
  calculateCumulative: boolean
): Promise<Result<void, DomainError>> {
  // Get all course attempts for the student
  const attempts = await getStudentCourseAttempts(studentId);

  if (attempts.length === 0) {
    // No attempts - nothing to calculate but not an error
    return ok(undefined);
  }

  // Calculate term GPA
  const termResult = calculateTermGpa(attempts, termId, GPA_OPTIONS);

  // Calculate cumulative GPA if requested
  let cumulativeResult = null;
  if (calculateCumulative) {
    cumulativeResult = calculateGpa(attempts, GPA_OPTIONS);
  }

  // Store results
  await storeGpaResults(studentId, termId, termResult, cumulativeResult);

  return ok(undefined);
}

interface RawCourseAttemptRow {
  registration_id: string;
  course_id: string;
  term_id: string;
  credits: string | number;
  grade_code: string | null;
  grade_points: string | number | null;
  include_in_gpa: boolean;
  credits_earned: boolean;
  repeat_policy: string;
}

/**
 * Get all course attempts for a student
 */
async function getStudentCourseAttempts(
  studentId: string
): Promise<CourseAttempt[]> {
  const query = sql`
    SELECT
      r.id as registration_id,
      r.section_id,
      sec.course_id,
      r.term_id,
      sec.credit_hours as credits,
      r.grade_code,
      g.grade_points,
      COALESCE(g.counts_toward_gpa, true) as include_in_gpa,
      COALESCE(g.earns_credit, false) as credits_earned,
      COALESCE(c.repeat_grade_policy, 'replace') as repeat_policy
    FROM enrollment.registrations r
    INNER JOIN curriculum.sections sec ON sec.id = r.section_id
    INNER JOIN curriculum.courses c ON c.id = sec.course_id
    LEFT JOIN curriculum.grades g ON g.code = r.grade_code
    WHERE r.student_id = ${studentId}
      AND r.status IN ('registered', 'completed')
    ORDER BY r.term_id, r.created_at
  `;

  const result = await db.execute(query);
  const rows = result as unknown as RawCourseAttemptRow[];

  return rows.map((row) => ({
    registrationId: String(row.registration_id),
    courseId: String(row.course_id),
    termId: String(row.term_id),
    credits: Number(row.credits),
    gradeCode: row.grade_code,
    gradePoints: row.grade_points !== null ? Number(row.grade_points) : null,
    includeInGpa: Boolean(row.include_in_gpa),
    creditsEarned: Boolean(row.credits_earned),
    isRepeat: false, // Will be determined by the calculator based on repeat policy
    repeatPolicy: row.repeat_policy as "replace" | "highest" | "average" | "all_count",
  }));
}

/**
 * Store GPA calculation results
 */
async function storeGpaResults(
  studentId: string,
  termId: string,
  termResult: ReturnType<typeof calculateTermGpa>,
  cumulativeResult: ReturnType<typeof calculateGpa> | null
): Promise<void> {
  // Upsert term GPA
  await db.execute(sql`
    INSERT INTO student.term_gpa (
      id,
      student_id,
      term_id,
      attempted_credits,
      earned_credits,
      quality_points,
      gpa_credits,
      term_gpa,
      calculated_at
    ) VALUES (
      gen_random_uuid(),
      ${studentId},
      ${termId},
      ${termResult.attemptedCredits},
      ${termResult.earnedCredits},
      ${termResult.qualityPoints},
      ${termResult.gpaCredits},
      ${termResult.cumulativeGpa},
      NOW()
    )
    ON CONFLICT (student_id, term_id)
    DO UPDATE SET
      attempted_credits = EXCLUDED.attempted_credits,
      earned_credits = EXCLUDED.earned_credits,
      quality_points = EXCLUDED.quality_points,
      gpa_credits = EXCLUDED.gpa_credits,
      term_gpa = EXCLUDED.term_gpa,
      calculated_at = NOW()
  `);

  // Update cumulative GPA in gpa_summary if calculated
  if (cumulativeResult) {
    await db.execute(sql`
      INSERT INTO student.gpa_summary (
        id,
        student_id,
        cumulative_attempted_credits,
        cumulative_earned_credits,
        cumulative_quality_points,
        cumulative_gpa_credits,
        cumulative_gpa,
        last_calculated_at
      ) VALUES (
        gen_random_uuid(),
        ${studentId},
        ${cumulativeResult.attemptedCredits},
        ${cumulativeResult.earnedCredits},
        ${cumulativeResult.qualityPoints},
        ${cumulativeResult.gpaCredits},
        ${cumulativeResult.cumulativeGpa},
        NOW()
      )
      ON CONFLICT (student_id)
      DO UPDATE SET
        cumulative_attempted_credits = EXCLUDED.cumulative_attempted_credits,
        cumulative_earned_credits = EXCLUDED.cumulative_earned_credits,
        cumulative_quality_points = EXCLUDED.cumulative_quality_points,
        cumulative_gpa_credits = EXCLUDED.cumulative_gpa_credits,
        cumulative_gpa = EXCLUDED.cumulative_gpa,
        last_calculated_at = NOW()
    `);
  }
}
