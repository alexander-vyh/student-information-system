/**
 * Job Data Types
 *
 * Type definitions for job payloads and results.
 */

import { z } from "zod";

// ============================================================================
// SAP Calculation Job
// ============================================================================

export const sapBatchJobDataSchema = z.object({
  /** Award year ID to calculate SAP for */
  awardYearId: z.string().uuid(),
  /** Term ID that triggered the calculation */
  termId: z.string().uuid(),
  /** Optional: specific student IDs to process (if empty, process all) */
  studentIds: z.array(z.string().uuid()).optional(),
  /** Batch identifier for grouping */
  batchId: z.string().uuid(),
  /** Whether to force recalculation even if recent */
  forceRecalculate: z.boolean().default(false),
});

export type SapBatchJobData = z.infer<typeof sapBatchJobDataSchema>;

export interface SapBatchJobResult {
  batchId: string;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  durationMs: number;
  errors: Array<{
    studentId: string;
    error: string;
  }>;
}

// ============================================================================
// GPA Calculation Job
// ============================================================================

export const gpaBatchJobDataSchema = z.object({
  /** Term ID to calculate GPA for */
  termId: z.string().uuid(),
  /** Optional: specific student IDs to process */
  studentIds: z.array(z.string().uuid()).optional(),
  /** Batch identifier */
  batchId: z.string().uuid(),
  /** Calculate cumulative GPA (true) or just term GPA (false) */
  calculateCumulative: z.boolean().default(true),
});

export type GpaBatchJobData = z.infer<typeof gpaBatchJobDataSchema>;

export interface GpaBatchJobResult {
  batchId: string;
  termId: string;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  durationMs: number;
  errors: Array<{
    studentId: string;
    error: string;
  }>;
}

// ============================================================================
// Waitlist Processing Job
// ============================================================================

export const waitlistProcessingJobDataSchema = z.object({
  /** Term ID to process waitlists for */
  termId: z.string().uuid(),
  /** Optional: specific section IDs to process (if empty, process all sections with openings) */
  sectionIds: z.array(z.string().uuid()).optional(),
  /** Batch identifier */
  batchId: z.string().uuid(),
  /** Whether to auto-enroll eligible students (true) or just notify them (false) */
  autoEnroll: z.boolean().default(false),
  /** Hours until notification expires (only if autoEnroll is false) */
  notificationExpiryHours: z.number().int().positive().default(24),
});

export type WaitlistProcessingJobData = z.infer<typeof waitlistProcessingJobDataSchema>;

export interface WaitlistProcessingJobResult {
  batchId: string;
  termId: string;
  sectionsProcessed: number;
  studentsProcessed: number;
  studentsEnrolled: number;
  studentsNotified: number;
  studentsSkipped: number;
  durationMs: number;
  errors: Array<{
    studentId: string;
    sectionId: string;
    error: string;
  }>;
}

// ============================================================================
// Generic Batch Job Types
// ============================================================================

export interface BatchProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
}

export interface BatchJobOptions {
  /** Number of records to process in each database query */
  batchSize: number;
  /** Maximum concurrent processing */
  concurrency: number;
}
