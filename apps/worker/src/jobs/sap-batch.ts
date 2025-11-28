/**
 * SAP Batch Calculation Job
 *
 * Calculates Satisfactory Academic Progress for students in batch.
 * Runs after grades are finalized for a term.
 *
 * Processing Flow:
 * 1. Query students with enrollments for the award year
 * 2. For each student, gather academic data
 * 3. Calculate SAP using domain calculator
 * 4. Store results in sap_records table
 * 5. Update student_aid_years with current SAP status
 */

import { Job } from "bullmq";
import { db } from "@sis/db";
import { sql } from "drizzle-orm";
import {
  calculateSap,
  DEFAULT_SAP_POLICY,
  ok,
  err,
  type Result,
  type DomainError,
  domainError,
  type SapStatus,
} from "@sis/domain";
import type { SapInput } from "@sis/domain";
import { createJobLogger } from "../logger.js";
import { config } from "../config.js";
import type {
  SapBatchJobData,
  SapBatchJobResult,
  BatchProgress,
} from "./types.js";

/**
 * Process SAP batch calculation
 */
export async function processSapBatchJob(
  job: Job<SapBatchJobData>
): Promise<Result<SapBatchJobResult, DomainError>> {
  const log = createJobLogger("sap-calculation", job.id ?? "unknown");
  const startTime = Date.now();
  const { awardYearId, termId, studentIds, batchId, forceRecalculate } =
    job.data;

  log.info(
    { awardYearId, termId, batchId, studentCount: studentIds?.length ?? "all" },
    "Starting SAP batch calculation"
  );

  const progress: BatchProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
  };

  const errors: SapBatchJobResult["errors"] = [];

  try {
    // Get students to process
    const students = await getStudentsForSapCalculation(
      awardYearId,
      studentIds
    );
    progress.total = students.length;

    log.info({ total: progress.total }, "Found students to process");

    // Process in batches
    const batchSize = config.BATCH_SIZE_SAP;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);

      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map((student) =>
          calculateAndStoreSapForStudent(
            student.id,
            awardYearId,
            termId,
            forceRecalculate
          )
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

    const result: SapBatchJobResult = {
      batchId,
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
      "SAP batch calculation completed"
    );

    return ok(result);
  } catch (error) {
    log.error({ err: error }, "SAP batch calculation failed");
    return err(
      domainError(
        "SAP_CALCULATION_FAILED",
        `Batch SAP calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { batchId, awardYearId, termId }
      )
    );
  }
}

/**
 * Get students eligible for SAP calculation
 */
async function getStudentsForSapCalculation(
  awardYearId: string,
  specificIds?: string[]
): Promise<Array<{ id: string }>> {
  // Query students who have aid for this award year
  const query = specificIds?.length
    ? sql`
        SELECT DISTINCT s.id
        FROM student.students s
        INNER JOIN aid.student_aid_years say ON say.student_id = s.id
        WHERE say.award_year_id = ${awardYearId}
          AND s.status = 'active'
          AND s.id = ANY(${specificIds})
        ORDER BY s.id
      `
    : sql`
        SELECT DISTINCT s.id
        FROM student.students s
        INNER JOIN aid.student_aid_years say ON say.student_id = s.id
        WHERE say.award_year_id = ${awardYearId}
          AND s.status = 'active'
        ORDER BY s.id
      `;

  const result = await db.execute(query);
  return result as unknown as Array<{ id: string }>;
}

/**
 * Calculate and store SAP for a single student
 */
async function calculateAndStoreSapForStudent(
  studentId: string,
  awardYearId: string,
  termId: string,
  _forceRecalculate: boolean
): Promise<Result<void, DomainError>> {
  // Get student's academic data for SAP calculation
  const academicData = await getStudentAcademicData(studentId, awardYearId);

  if (!academicData) {
    return err(
      domainError("SAP_DATA_INCOMPLETE", "Insufficient academic data for SAP", {
        studentId,
      })
    );
  }

  // Build SAP input
  const sapInput: SapInput = {
    cumulativeAttemptedCredits: academicData.attemptedCredits,
    cumulativeEarnedCredits: academicData.earnedCredits,
    cumulativeGpa: academicData.cumulativeGpa,
    programCredits: academicData.programCredits,
    previousSapStatus: academicData.previousSapStatus,
    appealApproved: academicData.appealApproved,
    onAcademicPlan: academicData.onAcademicPlan,
  };

  // Calculate SAP
  const sapResult = calculateSap(sapInput, DEFAULT_SAP_POLICY);

  // Store result
  await storeSapResult(studentId, awardYearId, termId, sapResult, sapInput);

  return ok(undefined);
}

interface RawStudentAcademicDataRow {
  attempted_credits: string | number | null;
  earned_credits: string | number | null;
  cumulative_gpa: string | number | null;
  program_credits: string | number | null;
  previous_sap_status: string | null;
  appeal_approved: boolean | null;
  on_academic_plan: boolean | null;
}

interface StudentAcademicData {
  attemptedCredits: number;
  earnedCredits: number;
  cumulativeGpa: number | null;
  programCredits: number;
  previousSapStatus?: SapStatus;
  appealApproved: boolean;
  onAcademicPlan: boolean;
}

const validSapStatuses: SapStatus[] = [
  "satisfactory",
  "warning",
  "probation",
  "suspension",
  "academic_plan",
];

function isValidSapStatus(status: string | null): status is SapStatus {
  return status !== null && validSapStatuses.includes(status as SapStatus);
}

/**
 * Get student's academic data for SAP calculation
 */
async function getStudentAcademicData(
  studentId: string,
  awardYearId: string
): Promise<StudentAcademicData | null> {
  // Query GPA summary and program info
  const query = sql`
    SELECT
      gs.cumulative_attempted_credits as attempted_credits,
      gs.cumulative_earned_credits as earned_credits,
      gs.cumulative_gpa,
      p.total_credits as program_credits,
      (
        SELECT sr.sap_status
        FROM aid.sap_records sr
        WHERE sr.student_id = ${studentId}
        ORDER BY sr.calculated_at DESC
        LIMIT 1
      ) as previous_sap_status,
      say.appeal_approved,
      say.on_academic_plan
    FROM student.students s
    LEFT JOIN student.gpa_summary gs ON gs.student_id = s.id
    LEFT JOIN student.student_programs sp ON sp.student_id = s.id AND sp.is_primary = true
    LEFT JOIN curriculum.programs p ON p.id = sp.program_id
    LEFT JOIN aid.student_aid_years say ON say.student_id = s.id AND say.award_year_id = ${awardYearId}
    WHERE s.id = ${studentId}
  `;

  const result = await db.execute(query);
  const rows = result as unknown as RawStudentAcademicDataRow[];

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (!row) return null;

  return {
    attemptedCredits: Number(row.attempted_credits ?? 0),
    earnedCredits: Number(row.earned_credits ?? 0),
    cumulativeGpa: row.cumulative_gpa ? Number(row.cumulative_gpa) : null,
    programCredits: Number(row.program_credits ?? 120), // Default 120 credits
    previousSapStatus: isValidSapStatus(row.previous_sap_status)
      ? row.previous_sap_status
      : undefined,
    appealApproved: Boolean(row.appeal_approved),
    onAcademicPlan: Boolean(row.on_academic_plan),
  };
}

/**
 * Store SAP calculation result
 */
async function storeSapResult(
  studentId: string,
  awardYearId: string,
  termId: string,
  result: ReturnType<typeof calculateSap>,
  input: SapInput
): Promise<void> {
  await db.execute(sql`
    INSERT INTO aid.sap_records (
      id,
      student_id,
      award_year_id,
      term_id,
      sap_status,
      eligible_for_aid,
      cumulative_gpa,
      cumulative_attempted_credits,
      cumulative_earned_credits,
      completion_rate,
      max_timeframe_percentage,
      requirements_met,
      status_reason,
      recommendations,
      calculated_at
    ) VALUES (
      gen_random_uuid(),
      ${studentId},
      ${awardYearId},
      ${termId},
      ${result.status},
      ${result.eligibleForAid},
      ${input.cumulativeGpa},
      ${input.cumulativeAttemptedCredits},
      ${input.cumulativeEarnedCredits},
      ${result.paceComponent.pacePercentage},
      ${result.maxTimeframeComponent.percentageUsed},
      ${result.allRequirementsMet},
      ${result.statusReason},
      ${JSON.stringify(result.recommendations)},
      NOW()
    )
    ON CONFLICT (student_id, award_year_id, term_id)
    DO UPDATE SET
      sap_status = EXCLUDED.sap_status,
      eligible_for_aid = EXCLUDED.eligible_for_aid,
      cumulative_gpa = EXCLUDED.cumulative_gpa,
      cumulative_attempted_credits = EXCLUDED.cumulative_attempted_credits,
      cumulative_earned_credits = EXCLUDED.cumulative_earned_credits,
      completion_rate = EXCLUDED.completion_rate,
      max_timeframe_percentage = EXCLUDED.max_timeframe_percentage,
      requirements_met = EXCLUDED.requirements_met,
      status_reason = EXCLUDED.status_reason,
      recommendations = EXCLUDED.recommendations,
      calculated_at = NOW()
  `);

  // Also update the student_aid_years table with current SAP status
  await db.execute(sql`
    UPDATE aid.student_aid_years
    SET sap_status = ${result.status}, updated_at = NOW()
    WHERE student_id = ${studentId} AND award_year_id = ${awardYearId}
  `);
}
