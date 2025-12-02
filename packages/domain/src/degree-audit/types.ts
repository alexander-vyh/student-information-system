/**
 * Degree Audit Types
 *
 * Types for tracking student progress toward degree completion.
 * Pure TypeScript with no database dependencies.
 */

/**
 * A completed or in-progress course for audit
 */
export interface StudentCourse {
  /** Unique identifier for this record */
  id: string;

  /** Course ID from catalog */
  courseId: string;

  /** Course code (e.g., "CS 101") */
  courseCode: string;

  /** Course title */
  courseTitle: string;

  /** Credits earned or in-progress */
  credits: number;

  /** Grade received (null if in-progress) */
  grade: string | null;

  /** Grade points (null if in-progress or non-GPA) */
  gradePoints: number | null;

  /** Source of the course */
  source: "registration" | "transfer" | "test_credit";

  /** Status */
  status: "completed" | "in_progress" | "withdrawn" | "failed";

  /** Term ID when taken (null for transfer/test) */
  termId: string | null;

  /** Subject code for subject-based matching */
  subjectCode: string;

  /** Course number for level-based matching (e.g., "101", "3300") */
  courseNumber: string;

  /** Course attributes (e.g., ["honors", "writing_intensive"]) */
  attributes: string[];
}

/**
 * A requirement that must be satisfied for graduation
 */
export interface DegreeRequirement {
  /** Requirement ID */
  id: string;

  /** Requirement name */
  name: string;

  /** Description */
  description: string | null;

  /** Category (e.g., "Core", "General Education", "Major") */
  categoryId: string | null;
  categoryName: string | null;

  /** Required credits (null if course-based) */
  minimumCredits: number | null;
  maximumCredits: number | null;

  /** Required number of courses (null if credit-based) */
  minimumCourses: number | null;

  /** Minimum GPA for this requirement */
  minimumGpa: number | null;

  /** Can courses count toward other requirements too? */
  allowSharing: boolean;

  /** Display order */
  displayOrder: number;

  /** Specific required courses */
  requiredCourses: RequirementCourse[];

  /** Flexible course groups (pick from list) */
  courseGroups: RequirementCourseGroup[];
}

/**
 * A specific course that satisfies a requirement
 */
export interface RequirementCourse {
  /** Course ID */
  courseId: string;

  /** Course code */
  courseCode: string;

  /** Course title */
  courseTitle: string;

  /** Credits */
  credits: number;

  /** Is this course required, or just an option? */
  isRequired: boolean;

  /** Minimum grade required */
  minimumGrade: string | null;
}

/**
 * A group of courses where student picks X courses/credits
 */
export interface RequirementCourseGroup {
  /** Group ID */
  id: string;

  /** Group name (e.g., "Humanities Elective") */
  name: string;

  /** Description */
  description: string | null;

  /** How many courses must be taken from this group */
  minimumCourses: number | null;

  /** How many credits must be taken from this group */
  minimumCredits: number | null;

  /** Selection rule for matching courses */
  selectionRule: CourseSelectionRule | null;

  /** Explicit courses in this group */
  courses: RequirementCourse[];
}

/**
 * Rule for matching courses to a group
 */
export interface CourseSelectionRule {
  type: "course_list" | "subject" | "level" | "attribute";
  courseIds?: string[];
  subjectCodes?: string[];
  minimumLevel?: string;
  maximumLevel?: string;
  attributes?: string[];
  excludeCourseIds?: string[];
}

/**
 * Overall degree audit result
 */
export interface DegreeAuditResult {
  /** Student info */
  studentId: string;
  studentProgramId: string;

  /** Program info */
  programId: string;
  programName: string;
  programCode: string;
  catalogYearId: string | null;
  catalogYearCode: string | null;

  /** Audit timestamp */
  auditDate: Date;

  /** Overall progress */
  totalCreditsRequired: number;
  totalCreditsEarned: number;
  totalCreditsInProgress: number;
  completionPercentage: number;

  /** GPA summary */
  overallGpaRequired: number | null;
  overallGpaActual: number | null;
  majorGpaRequired: number | null;
  majorGpaActual: number | null;

  /** Overall status */
  status: "complete" | "in_progress" | "incomplete";

  /** Breakdown by requirement */
  requirements: RequirementAuditResult[];

  /** All courses applied to requirements */
  coursesApplied: AppliedCourse[];

  /** Courses not yet applied (electives, excess credits) */
  unusedCourses: StudentCourse[];

  /** Summary messages */
  messages: AuditMessage[];
}

/**
 * Result for a single requirement
 */
export interface RequirementAuditResult {
  /** Requirement ID */
  requirementId: string;

  /** Requirement name */
  requirementName: string;

  /** Category */
  categoryId: string | null;
  categoryName: string | null;

  /** Status */
  status: "complete" | "in_progress" | "incomplete" | "not_started";

  /** Credit progress */
  creditsRequired: number;
  creditsEarned: number;
  creditsInProgress: number;

  /** Course count progress */
  coursesRequired: number;
  coursesCompleted: number;
  coursesInProgress: number;

  /** GPA for this requirement */
  gpaRequired: number | null;
  gpaActual: number | null;
  gpaCredits: number;
  gpaQualityPoints: number;

  /** Courses applied to this requirement */
  appliedCourses: AppliedCourse[];

  /** Required courses not yet taken */
  missingCourses: RequirementCourse[];

  /** Course groups status */
  courseGroupResults: CourseGroupAuditResult[];

  /** Display order */
  displayOrder: number;

  /** Notes */
  notes: string | null;
}

/**
 * Result for a course group within a requirement
 */
export interface CourseGroupAuditResult {
  /** Group ID */
  groupId: string;

  /** Group name */
  groupName: string;

  /** Status */
  status: "complete" | "in_progress" | "incomplete" | "not_started";

  /** Progress */
  coursesRequired: number;
  coursesApplied: number;
  creditsRequired: number;
  creditsApplied: number;

  /** Courses used */
  appliedCourses: AppliedCourse[];

  /** Remaining options (if not complete) */
  remainingOptions: RequirementCourse[];
}

/**
 * A course applied to a requirement
 */
export interface AppliedCourse {
  /** Course info */
  courseId: string;
  courseCode: string;
  courseTitle: string;

  /** Source record */
  sourceId: string;
  source: "registration" | "transfer" | "test_credit";

  /** Credits */
  credits: number;

  /** Grade */
  grade: string | null;
  gradePoints: number | null;

  /** Term */
  termId: string | null;

  /** Status */
  status: "completed" | "in_progress";

  /** Requirements this course is applied to */
  requirementIds: string[];

  /** Meets minimum grade requirement? */
  meetsGradeRequirement: boolean;
}

/**
 * Audit message for user display
 */
export interface AuditMessage {
  type: "info" | "warning" | "error";
  category: "gpa" | "credits" | "requirement" | "general";
  message: string;
  requirementId?: string;
}

/**
 * Options for running the audit
 */
export interface DegreeAuditOptions {
  /** Include in-progress courses? Default: true */
  includeInProgress?: boolean;

  /** Check GPA requirements? Default: true */
  checkGpa?: boolean;

  /** Allow course sharing between requirements? Default: per-requirement setting */
  allowSharing?: boolean;

  /** Minimum passing grade codes (default: ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-"]) */
  passingGrades?: string[];

  /** Grade comparison function */
  gradeCompare?: (grade1: string, grade2: string) => number;
}

/**
 * Input data for degree audit calculation
 */
export interface DegreeAuditInput {
  /** Student info */
  studentId: string;
  studentProgramId: string;

  /** Program info */
  programId: string;
  programName: string;
  programCode: string;
  totalCreditsRequired: number;
  catalogYearId: string | null;
  catalogYearCode: string | null;

  /** GPA requirements */
  overallGpaRequired: number | null;
  majorGpaRequired: number | null;

  /** Student's current GPA */
  overallGpaActual: number | null;

  /** All degree requirements */
  requirements: DegreeRequirement[];

  /** All student courses */
  studentCourses: StudentCourse[];
}
