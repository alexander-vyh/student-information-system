/**
 * Enrollment Query Helpers
 *
 * Reusable queries for registrations, sections, and courses.
 * Used across enrollment, degree-audit, transcript, and graduation routers.
 */

import { eq, and, inArray } from "drizzle-orm";
import type { db } from "../index.js";
import { registrations } from "../schema/index.js";

type Database = typeof db;

// =============================================================================
// Types
// =============================================================================

export interface RegistrationQueryOptions {
  /** Include in-progress (registered) courses. Default: true */
  includeInProgress?: boolean;
  /** Include dropped courses. Default: false */
  includeDropped?: boolean;
  /** Include withdrawn courses. Default: false */
  includeWithdrawn?: boolean;
  /** Include completed courses. Default: true */
  includeCompleted?: boolean;
  /** Filter by specific term */
  termId?: string;
  /** Limit number of results */
  limit?: number;
}

// =============================================================================
// Registration Queries
// =============================================================================

/**
 * Get student registrations with full section/course/term details.
 * Used in: degree-audit, transcript, enrollment, graduation
 */
export async function getRegistrationsWithDetails(
  database: Database,
  studentId: string,
  options: RegistrationQueryOptions = {}
) {
  const {
    includeInProgress = true,
    includeDropped = false,
    includeWithdrawn = false,
    includeCompleted = true,
    termId,
    limit,
  } = options;

  const statusList: string[] = [];
  if (includeInProgress) statusList.push("registered");
  if (includeCompleted) statusList.push("completed");
  if (includeDropped) statusList.push("dropped");
  if (includeWithdrawn) statusList.push("withdrawn");

  if (statusList.length === 0) {
    return [];
  }

  const conditions = [
    eq(registrations.studentId, studentId),
    inArray(registrations.status, statusList),
  ];

  if (termId) {
    conditions.push(eq(registrations.termId, termId));
  }

  return database.query.registrations.findMany({
    where: and(...conditions),
    with: {
      section: {
        with: {
          course: {
            with: {
              subject: true,
            },
          },
        },
      },
      term: true,
      grade: true,
    },
    limit,
  });
}

/**
 * Get registrations for a specific term.
 * Used in: enrollment (schedule view)
 */
export async function getTermRegistrations(
  database: Database,
  studentId: string,
  termId: string
) {
  return database.query.registrations.findMany({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.termId, termId),
      inArray(registrations.status, ["registered", "waitlisted"])
    ),
    with: {
      section: {
        with: {
          course: true,
        },
      },
    },
  });
}

/**
 * Get completed registrations (for GPA calculation, degree audit).
 * Used in: degree-audit, transcript
 */
export async function getCompletedRegistrations(
  database: Database,
  studentId: string
) {
  return database.query.registrations.findMany({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.status, "completed")
    ),
    with: {
      section: {
        with: {
          course: {
            with: {
              subject: true,
            },
          },
        },
      },
      term: true,
      grade: true,
    },
  });
}

/**
 * Get registrations with incomplete grades.
 * Used in: graduation
 */
export async function getIncompleteGradeRegistrations(
  database: Database,
  studentId: string
) {
  return database.query.registrations.findMany({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.gradeCode, "I")
    ),
    with: {
      section: {
        with: {
          course: true,
        },
      },
    },
  });
}

/**
 * Get registrations with pending grades (still registered, not yet graded).
 * Used in: graduation
 */
export async function getPendingGradeRegistrations(
  database: Database,
  studentId: string
) {
  return database.query.registrations.findMany({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.status, "registered")
    ),
    with: {
      section: {
        with: {
          course: true,
        },
      },
    },
  });
}

/**
 * Check if student has a registration for a specific section.
 * Used in: enrollment (duplicate check)
 */
export async function getExistingRegistration(
  database: Database,
  studentId: string,
  sectionId: string
) {
  return database.query.registrations.findFirst({
    where: and(
      eq(registrations.studentId, studentId),
      eq(registrations.sectionId, sectionId),
      inArray(registrations.status, ["registered", "waitlisted"])
    ),
    with: {
      section: {
        with: {
          course: true,
        },
      },
    },
  });
}
