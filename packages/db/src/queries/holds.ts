/**
 * Hold Query Helpers
 *
 * Reusable queries for registration holds.
 * Used across enrollment, graduation, and transcript routers.
 */

import { eq, and, isNull } from "drizzle-orm";
import type { db } from "../index.js";
import { registrationHolds } from "../schema/index.js";

type Database = typeof db;

// =============================================================================
// Types
// =============================================================================

export interface HoldBlockType {
  /** Filter holds that block registration */
  blocksRegistration?: boolean;
  /** Filter holds that block diploma/graduation */
  blocksDiploma?: boolean;
  /** Filter holds that block transcripts */
  blocksTranscript?: boolean;
}

// =============================================================================
// Hold Queries
// =============================================================================

/**
 * Get all active holds for a student.
 * Used in: student details, enrollment
 */
export async function getActiveHolds(database: Database, studentId: string) {
  return database.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      isNull(registrationHolds.resolvedAt)
    ),
  });
}

/**
 * Get holds that block registration.
 * Used in: enrollment
 */
export async function getRegistrationBlockingHolds(
  database: Database,
  studentId: string
) {
  return database.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      eq(registrationHolds.blocksRegistration, true),
      isNull(registrationHolds.resolvedAt)
    ),
  });
}

/**
 * Get holds that block graduation/diploma.
 * Used in: graduation
 */
export async function getGraduationBlockingHolds(
  database: Database,
  studentId: string
) {
  return database.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      eq(registrationHolds.blocksDiploma, true),
      isNull(registrationHolds.resolvedAt)
    ),
  });
}

/**
 * Get holds that block transcripts.
 * Used in: transcript
 */
export async function getTranscriptBlockingHolds(
  database: Database,
  studentId: string
) {
  return database.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      eq(registrationHolds.blocksTranscript, true),
      isNull(registrationHolds.resolvedAt)
    ),
  });
}

/**
 * Get holds with flexible filtering.
 * Used in: graduation, transcript, enrollment
 */
export async function getBlockingHolds(
  database: Database,
  studentId: string,
  blockType: HoldBlockType
) {
  const allHolds = await getActiveHolds(database, studentId);

  // Filter based on block type
  return allHolds.filter((hold) => {
    if (blockType.blocksRegistration && hold.blocksRegistration) return true;
    if (blockType.blocksDiploma && hold.blocksDiploma) return true;
    if (blockType.blocksTranscript && hold.blocksTranscript) return true;
    return false;
  });
}
