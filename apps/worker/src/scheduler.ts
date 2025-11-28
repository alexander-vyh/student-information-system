/**
 * Job Scheduler
 *
 * Utilities for scheduling jobs from other parts of the application.
 * Can be imported by the API layer to enqueue background jobs.
 */

import { getQueue, QUEUE_NAMES } from "./queue/index.js";
import { v4 as uuidv4 } from "uuid";
import type { SapBatchJobData, GpaBatchJobData } from "./jobs/index.js";

/**
 * Schedule options for delayed or recurring jobs
 */
export interface ScheduleOptions {
  /** Delay before processing (ms) */
  delay?: number;
  /** Priority (lower = higher priority, default 0) */
  priority?: number;
  /** Job ID for deduplication */
  jobId?: string;
}

/**
 * Schedule a SAP batch calculation job
 */
export async function scheduleSapCalculation(
  data: Omit<SapBatchJobData, "batchId">,
  options: ScheduleOptions = {}
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.SAP_CALCULATION);
  const batchId = uuidv4();

  const job = await queue.add(
    "sap-batch",
    { ...data, batchId },
    {
      delay: options.delay,
      priority: options.priority,
      jobId: options.jobId ?? `sap-${batchId}`,
    }
  );

  return job.id ?? batchId;
}

/**
 * Schedule a GPA batch calculation job
 */
export async function scheduleGpaCalculation(
  data: Omit<GpaBatchJobData, "batchId">,
  options: ScheduleOptions = {}
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.GPA_CALCULATION);
  const batchId = uuidv4();

  const job = await queue.add(
    "gpa-batch",
    { ...data, batchId },
    {
      delay: options.delay,
      priority: options.priority,
      jobId: options.jobId ?? `gpa-${batchId}`,
    }
  );

  return job.id ?? batchId;
}

/**
 * Schedule SAP calculation for a single student (convenience wrapper)
 */
export async function scheduleSapForStudent(
  studentId: string,
  awardYearId: string,
  termId: string,
  options: ScheduleOptions = {}
): Promise<string> {
  return scheduleSapCalculation(
    {
      awardYearId,
      termId,
      studentIds: [studentId],
      forceRecalculate: true,
    },
    {
      ...options,
      jobId: `sap-student-${studentId}-${awardYearId}`,
    }
  );
}

/**
 * Schedule GPA calculation for a single student (convenience wrapper)
 */
export async function scheduleGpaForStudent(
  studentId: string,
  termId: string,
  options: ScheduleOptions = {}
): Promise<string> {
  return scheduleGpaCalculation(
    {
      termId,
      studentIds: [studentId],
      calculateCumulative: true,
    },
    {
      ...options,
      jobId: `gpa-student-${studentId}-${termId}`,
    }
  );
}

/**
 * Get job status
 */
export async function getJobStatus(queueName: keyof typeof QUEUE_NAMES, jobId: string) {
  const queue = getQueue(QUEUE_NAMES[queueName]);
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    name: job.name,
    state,
    progress,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}
