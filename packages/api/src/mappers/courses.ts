/**
 * Course Mappers
 *
 * Transform database course/registration records to domain types.
 * Used for combining registrations, transfer credits, and test credits.
 */

import { parseDecimalFixed } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Unified course representation for degree audit.
 * Combines registrations, transfer credits, and test credits.
 */
export interface StudentCourse {
  /** Source of credit */
  source: "registration" | "transfer" | "test";
  /** Unique ID from source table */
  sourceId: string;
  /** Course code (e.g., "CS 101") */
  courseCode: string;
  /** Course title */
  courseTitle: string;
  /** Credits earned/awarded */
  credits: number;
  /** Grade received (null for in-progress) */
  grade: string | null;
  /** Grade points (null if not graded) */
  gradePoints: number | null;
  /** Whether grade counts toward GPA */
  countsTowardGpa: boolean;
  /** Term completed (null for transfer/test) */
  termId: string | null;
  /** Term name for display */
  termName: string | null;
  /** Status (completed, in-progress, etc.) */
  status: "completed" | "in_progress" | "withdrawn" | "dropped";
  /** Subject area code (e.g., "CS") */
  subjectCode: string | null;
  /** Course number (e.g., "101") */
  courseNumber: string | null;
}

// =============================================================================
// Registration Mapper
// =============================================================================

export interface DbRegistrationWithDetails {
  id: string;
  status: string;
  gradeCode: string | null;
  section: {
    course: {
      id: string;
      courseNumber: string;
      title: string;
      creditHours: string | null;
      subject: {
        code: string;
        name: string;
      } | null;
    };
  };
  term: {
    id: string;
    name: string;
  };
  grade: {
    letterGrade: string;
    gradePoints: string | null;
    countsTowardGpa: boolean;
  } | null;
}

export function registrationToStudentCourse(
  reg: DbRegistrationWithDetails
): StudentCourse {
  const course = reg.section.course;
  const subject = course.subject;

  return {
    source: "registration",
    sourceId: reg.id,
    courseCode: subject ? `${subject.code} ${course.courseNumber}` : course.courseNumber,
    courseTitle: course.title,
    credits: parseDecimalFixed(course.creditHours, 1, 3),
    grade: reg.grade?.letterGrade ?? reg.gradeCode ?? null,
    gradePoints: reg.grade?.gradePoints
      ? parseDecimalFixed(reg.grade.gradePoints, 2)
      : null,
    countsTowardGpa: reg.grade?.countsTowardGpa ?? false,
    termId: reg.term.id,
    termName: reg.term.name,
    status: mapRegistrationStatus(reg.status),
    subjectCode: subject?.code ?? null,
    courseNumber: course.courseNumber,
  };
}

function mapRegistrationStatus(
  status: string
): StudentCourse["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "registered":
    case "waitlisted":
      return "in_progress";
    case "withdrawn":
      return "withdrawn";
    case "dropped":
      return "dropped";
    default:
      return "completed";
  }
}

// =============================================================================
// Transfer Credit Mapper
// =============================================================================

export interface DbTransferCredit {
  id: string;
  sourceInstitution: string;
  sourceCourseCode: string;
  sourceCourseTitle: string;
  sourceCredits: string | null;
  equivalentCourseId: string | null;
  equivalentCourse?: {
    courseNumber: string;
    title: string;
    creditHours: string | null;
    subject: {
      code: string;
    } | null;
  } | null;
  creditsAwarded: string | null;
  gradeEquivalent: string | null;
  status: string;
}

export function transferCreditToStudentCourse(
  tc: DbTransferCredit
): StudentCourse {
  const equiv = tc.equivalentCourse;

  // Use equivalent course info if mapped, otherwise source info
  const courseCode = equiv && equiv.subject
    ? `${equiv.subject.code} ${equiv.courseNumber}`
    : tc.sourceCourseCode;
  const courseTitle = equiv?.title ?? tc.sourceCourseTitle;

  return {
    source: "transfer",
    sourceId: tc.id,
    courseCode,
    courseTitle,
    credits: parseDecimalFixed(tc.creditsAwarded ?? tc.sourceCredits, 1, 3),
    grade: tc.gradeEquivalent ?? "TR",
    gradePoints: null, // Transfer grades typically don't have points
    countsTowardGpa: false, // Most institutions don't count transfer in GPA
    termId: null,
    termName: null,
    status: tc.status === "accepted" ? "completed" : "in_progress",
    subjectCode: equiv?.subject?.code ?? null,
    courseNumber: equiv?.courseNumber ?? null,
  };
}

// =============================================================================
// Test Credit Mapper
// =============================================================================

export interface DbTestCredit {
  id: string;
  testType: string; // AP, CLEP, IB, etc.
  testName: string;
  score: string | null;
  equivalentCourseId: string | null;
  equivalentCourse?: {
    courseNumber: string;
    title: string;
    creditHours: string | null;
    subject: {
      code: string;
    } | null;
  } | null;
  creditsAwarded: string | null;
  status: string;
}

export function testCreditToStudentCourse(
  tc: DbTestCredit
): StudentCourse {
  const equiv = tc.equivalentCourse;

  const courseCode = equiv && equiv.subject
    ? `${equiv.subject.code} ${equiv.courseNumber}`
    : `${tc.testType} - ${tc.testName}`;
  const courseTitle = equiv?.title ?? `${tc.testType}: ${tc.testName}`;

  return {
    source: "test",
    sourceId: tc.id,
    courseCode,
    courseTitle,
    credits: parseDecimalFixed(tc.creditsAwarded ?? equiv?.creditHours, 1, 3),
    grade: tc.score ? `${tc.testType}:${tc.score}` : tc.testType,
    gradePoints: null,
    countsTowardGpa: false,
    termId: null,
    termName: null,
    status: tc.status === "awarded" ? "completed" : "in_progress",
    subjectCode: equiv?.subject?.code ?? null,
    courseNumber: equiv?.courseNumber ?? null,
  };
}

// =============================================================================
// Combining Multiple Sources
// =============================================================================

/**
 * Combine all course sources into a unified list.
 * Used in: degree-audit, transcript
 */
export function toStudentCourses(
  registrations: DbRegistrationWithDetails[],
  transferCredits: DbTransferCredit[],
  testCredits: DbTestCredit[]
): StudentCourse[] {
  const courses: StudentCourse[] = [];

  for (const reg of registrations) {
    courses.push(registrationToStudentCourse(reg));
  }

  for (const tc of transferCredits) {
    courses.push(transferCreditToStudentCourse(tc));
  }

  for (const tc of testCredits) {
    courses.push(testCreditToStudentCourse(tc));
  }

  return courses;
}

/**
 * Filter courses to only completed ones.
 */
export function getCompletedCourses(courses: StudentCourse[]): StudentCourse[] {
  return courses.filter((c) => c.status === "completed");
}

/**
 * Filter courses by subject area.
 */
export function getCoursesBySubject(
  courses: StudentCourse[],
  subjectCode: string
): StudentCourse[] {
  return courses.filter((c) => c.subjectCode === subjectCode);
}

/**
 * Calculate total credits from a list of courses.
 */
export function getTotalCredits(courses: StudentCourse[]): number {
  return courses.reduce((sum, c) => sum + c.credits, 0);
}
