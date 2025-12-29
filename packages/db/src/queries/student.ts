/**
 * Student Query Helpers
 *
 * Reusable queries for student, GPA summary, and program data.
 * Used across academic-standing, degree-audit, graduation, and transcript routers.
 */

import { eq, and } from "drizzle-orm";
import type { db } from "../index.js";
import {
  students,
  studentPrograms,
  studentGpaSummary,
} from "../schema/index.js";

type Database = typeof db;

// =============================================================================
// Student Queries
// =============================================================================

/**
 * Get student with their primary program and GPA summary.
 * Used in: academic-standing, degree-audit, graduation, transcript
 *
 * Note: Returns raw studentProgram data. Program details must be
 * joined separately via curriculum.programs if needed.
 */
export async function getStudentWithProgramAndGpa(
  database: Database,
  studentId: string
) {
  const student = await database.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student) return null;

  const [primaryProgram, gpaSummary] = await Promise.all([
    database.query.studentPrograms.findFirst({
      where: and(
        eq(studentPrograms.studentId, studentId),
        eq(studentPrograms.isPrimary, true)
      ),
      with: {
        majors: true,
      },
    }),
    database.query.studentGpaSummary.findFirst({
      where: eq(studentGpaSummary.studentId, studentId),
    }),
  ]);

  return {
    student,
    primaryProgram: primaryProgram ?? null,
    gpaSummary: gpaSummary ?? null,
  };
}

/**
 * Get just the GPA summary for a student.
 * Used in: academic-standing, graduation, enrollment, transcript
 */
export async function getGpaSummary(database: Database, studentId: string) {
  return database.query.studentGpaSummary.findFirst({
    where: eq(studentGpaSummary.studentId, studentId),
  });
}

/**
 * Get student's primary program with optional majors.
 * Used in: academic-standing, graduation, degree-audit
 *
 * Note: Returns studentProgram with programId. Caller must join
 * to curriculum.programs for full program details.
 */
export async function getPrimaryProgram(
  database: Database,
  studentId: string,
  options?: { includeMajors?: boolean }
) {
  return database.query.studentPrograms.findFirst({
    where: and(
      eq(studentPrograms.studentId, studentId),
      eq(studentPrograms.isPrimary, true)
    ),
    with: options?.includeMajors
      ? { majors: true }
      : undefined,
  });
}

/**
 * Get all student programs (primary and secondary).
 * Used in: degree-audit
 *
 * Note: Returns studentPrograms with programIds. Caller must join
 * to curriculum.programs for full program details.
 */
export async function getAllStudentPrograms(
  database: Database,
  studentId: string
) {
  return database.query.studentPrograms.findMany({
    where: eq(studentPrograms.studentId, studentId),
    with: {
      majors: true,
    },
  });
}
