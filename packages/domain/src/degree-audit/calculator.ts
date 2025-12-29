/**
 * Degree Audit Calculator
 *
 * Pure TypeScript implementation for calculating student degree progress.
 * No database dependencies - receives all data as parameters.
 */

import {
  StudentCourse,
  DegreeRequirement,
  DegreeAuditResult,
  RequirementAuditResult,
  CourseGroupAuditResult,
  AppliedCourse,
  AuditMessage,
  DegreeAuditOptions,
  DegreeAuditInput,
  RequirementCourse,
  RequirementCourseGroup,
  CourseSelectionRule,
} from "./types.js";

// Default passing grades ordered from highest to lowest
const DEFAULT_PASSING_GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-"];

// Standard grade order for comparison
const GRADE_ORDER: Record<string, number> = {
  "A+": 13, "A": 12, "A-": 11,
  "B+": 10, "B": 9, "B-": 8,
  "C+": 7, "C": 6, "C-": 5,
  "D+": 4, "D": 3, "D-": 2,
  "F": 1,
  "W": 0, "WF": 0, "I": 0, "IP": 0,
};

/**
 * Compare two grades. Returns positive if grade1 > grade2.
 */
function defaultGradeCompare(grade1: string, grade2: string): number {
  const order1 = GRADE_ORDER[grade1.toUpperCase()] ?? 0;
  const order2 = GRADE_ORDER[grade2.toUpperCase()] ?? 0;
  return order1 - order2;
}

/**
 * Check if a grade meets the minimum requirement
 */
function meetsMinimumGrade(
  actual: string | null,
  required: string | null,
  gradeCompare: (g1: string, g2: string) => number
): boolean {
  if (!required) return true;
  if (!actual) return false;
  return gradeCompare(actual, required) >= 0;
}

/**
 * Check if a course matches a selection rule
 */
function courseMatchesRule(course: StudentCourse, rule: CourseSelectionRule): boolean {
  // Check exclusions first
  if (rule.excludeCourseIds?.includes(course.courseId)) {
    return false;
  }

  switch (rule.type) {
    case "course_list":
      return rule.courseIds?.includes(course.courseId) ?? false;

    case "subject":
      return rule.subjectCodes?.includes(course.subjectCode) ?? false;

    case "level": {
      const courseNum = parseInt(course.courseNumber, 10);
      const minLevel = rule.minimumLevel ? parseInt(rule.minimumLevel, 10) : 0;
      const maxLevel = rule.maximumLevel ? parseInt(rule.maximumLevel, 10) : 9999;
      return courseNum >= minLevel && courseNum <= maxLevel;
    }

    case "attribute":
      return rule.attributes?.some(attr => course.attributes.includes(attr)) ?? false;

    default:
      return false;
  }
}

/**
 * Calculate the degree audit for a student
 */
export function calculateDegreeAudit(
  input: DegreeAuditInput,
  options: DegreeAuditOptions = {}
): DegreeAuditResult {
  const {
    includeInProgress = true,
    checkGpa = true,
    passingGrades = DEFAULT_PASSING_GRADES,
    gradeCompare = defaultGradeCompare,
  } = options;

  // Track which courses have been used and for which requirements
  const courseUsage = new Map<string, string[]>(); // courseId -> requirementIds

  // Filter courses based on options
  const eligibleCourses = input.studentCourses.filter(course => {
    if (course.status === "withdrawn" || course.status === "failed") return false;
    if (!includeInProgress && course.status === "in_progress") return false;
    return true;
  });

  // Collect all messages
  const messages: AuditMessage[] = [];

  // Sort requirements by display order
  const sortedRequirements = [...input.requirements].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  // Calculate each requirement
  const requirementResults: RequirementAuditResult[] = sortedRequirements.map(req => {
    return evaluateRequirement(
      req,
      eligibleCourses,
      courseUsage,
      messages,
      passingGrades,
      gradeCompare
    );
  });

  // Collect all applied courses
  const appliedCourses: AppliedCourse[] = [];
  for (const result of requirementResults) {
    for (const applied of result.appliedCourses) {
      // Check if this course is already in applied list
      const existing = appliedCourses.find(c => c.sourceId === applied.sourceId);
      if (existing) {
        // Add this requirement ID to the existing entry
        const firstReqId = applied.requirementIds[0];
        if (firstReqId && !existing.requirementIds.includes(firstReqId)) {
          existing.requirementIds.push(...applied.requirementIds);
        }
      } else {
        appliedCourses.push({ ...applied });
      }
    }
  }

  // Find unused courses
  const usedCourseIds = new Set(appliedCourses.map(c => c.sourceId));
  const unusedCourses = eligibleCourses.filter(c => !usedCourseIds.has(c.id));

  // Calculate totals
  const totalCreditsEarned = eligibleCourses
    .filter(c => c.status === "completed")
    .reduce((sum, c) => sum + c.credits, 0);

  const totalCreditsInProgress = eligibleCourses
    .filter(c => c.status === "in_progress")
    .reduce((sum, c) => sum + c.credits, 0);

  // Calculate completion percentage
  const completionPercentage = input.totalCreditsRequired > 0
    ? Math.min(100, (totalCreditsEarned / input.totalCreditsRequired) * 100)
    : 0;

  // Check overall GPA requirements
  if (checkGpa && input.overallGpaRequired && input.overallGpaActual !== null) {
    if (input.overallGpaActual < input.overallGpaRequired) {
      messages.push({
        type: "warning",
        category: "gpa",
        message: `Overall GPA (${input.overallGpaActual.toFixed(3)}) is below the required ${input.overallGpaRequired.toFixed(3)}`,
      });
    }
  }

  // Calculate major GPA if needed
  let majorGpaActual: number | null = null;
  if (input.majorGpaRequired) {
    // Find major requirements and calculate GPA from those courses
    const majorRequirements = requirementResults.filter(
      r => r.categoryName?.toLowerCase().includes("major") ||
           r.requirementName.toLowerCase().includes("major")
    );

    let totalQualityPoints = 0;
    let totalGpaCredits = 0;

    for (const req of majorRequirements) {
      totalQualityPoints += req.gpaQualityPoints;
      totalGpaCredits += req.gpaCredits;
    }

    majorGpaActual = totalGpaCredits > 0
      ? Math.round((totalQualityPoints / totalGpaCredits) * 1000) / 1000
      : null;

    if (majorGpaActual !== null && majorGpaActual < input.majorGpaRequired) {
      messages.push({
        type: "warning",
        category: "gpa",
        message: `Major GPA (${majorGpaActual.toFixed(3)}) is below the required ${input.majorGpaRequired.toFixed(3)}`,
      });
    }
  }

  // Determine overall status
  const allComplete = requirementResults.every(r => r.status === "complete");
  const anyInProgress = requirementResults.some(r => r.status === "in_progress");
  const gpaOk = !input.overallGpaRequired ||
    (input.overallGpaActual !== null && input.overallGpaActual >= input.overallGpaRequired);
  const majorGpaOk = !input.majorGpaRequired ||
    (majorGpaActual !== null && majorGpaActual >= input.majorGpaRequired);

  let status: "complete" | "in_progress" | "incomplete";
  if (allComplete && gpaOk && majorGpaOk) {
    status = "complete";
  } else if (anyInProgress) {
    status = "in_progress";
  } else {
    status = "incomplete";
  }

  return {
    studentId: input.studentId,
    studentProgramId: input.studentProgramId,
    programId: input.programId,
    programName: input.programName,
    programCode: input.programCode,
    catalogYearId: input.catalogYearId,
    catalogYearCode: input.catalogYearCode,
    auditDate: new Date(),
    totalCreditsRequired: input.totalCreditsRequired,
    totalCreditsEarned,
    totalCreditsInProgress,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    overallGpaRequired: input.overallGpaRequired,
    overallGpaActual: input.overallGpaActual,
    majorGpaRequired: input.majorGpaRequired,
    majorGpaActual,
    status,
    requirements: requirementResults,
    coursesApplied: appliedCourses,
    unusedCourses,
    messages,
  };
}

/**
 * Evaluate a single requirement
 */
function evaluateRequirement(
  requirement: DegreeRequirement,
  courses: StudentCourse[],
  courseUsage: Map<string, string[]>,
  messages: AuditMessage[],
  passingGrades: string[],
  gradeCompare: (g1: string, g2: string) => number
): RequirementAuditResult {
  const appliedCourses: AppliedCourse[] = [];
  const missingCourses: RequirementCourse[] = [];
  const courseGroupResults: CourseGroupAuditResult[] = [];

  // Track credits and courses for this requirement
  let creditsEarned = 0;
  let creditsInProgress = 0;
  let coursesCompleted = 0;
  let coursesInProgress = 0;
  let gpaCredits = 0;
  let gpaQualityPoints = 0;

  // Helper to apply a course
  const applyCourse = (
    studentCourse: StudentCourse,
    reqCourse: RequirementCourse | null
  ): boolean => {
    // Check if already used (unless sharing is allowed)
    const existingUsage = courseUsage.get(studentCourse.id) || [];
    if (!requirement.allowSharing && existingUsage.length > 0) {
      return false;
    }

    // Check minimum grade if required
    const minGrade = reqCourse?.minimumGrade || null;
    const meetsGrade = meetsMinimumGrade(studentCourse.grade, minGrade, gradeCompare);

    // Check if it's a passing grade
    const isPassing = studentCourse.grade
      ? passingGrades.includes(studentCourse.grade)
      : studentCourse.status === "in_progress";

    if (!isPassing && studentCourse.status !== "in_progress") {
      return false;
    }

    // Apply the course
    const applied: AppliedCourse = {
      courseId: studentCourse.courseId,
      courseCode: studentCourse.courseCode,
      courseTitle: studentCourse.courseTitle,
      sourceId: studentCourse.id,
      source: studentCourse.source,
      credits: studentCourse.credits,
      grade: studentCourse.grade,
      gradePoints: studentCourse.gradePoints,
      termId: studentCourse.termId,
      status: studentCourse.status === "in_progress" ? "in_progress" : "completed",
      requirementIds: [requirement.id],
      meetsGradeRequirement: meetsGrade,
    };

    appliedCourses.push(applied);

    // Update usage tracking
    existingUsage.push(requirement.id);
    courseUsage.set(studentCourse.id, existingUsage);

    // Update counters
    if (studentCourse.status === "completed") {
      creditsEarned += studentCourse.credits;
      coursesCompleted++;
      if (studentCourse.gradePoints !== null) {
        gpaCredits += studentCourse.credits;
        gpaQualityPoints += studentCourse.credits * studentCourse.gradePoints;
      }
    } else {
      creditsInProgress += studentCourse.credits;
      coursesInProgress++;
    }

    return true;
  };

  // 1. First, match required courses
  for (const reqCourse of requirement.requiredCourses) {
    if (!reqCourse.isRequired) continue;

    const studentCourse = courses.find(
      c => c.courseId === reqCourse.courseId &&
           (c.status === "completed" || c.status === "in_progress")
    );

    if (studentCourse) {
      applyCourse(studentCourse, reqCourse);
    } else {
      missingCourses.push(reqCourse);
    }
  }

  // 2. Match optional courses from required courses list
  for (const reqCourse of requirement.requiredCourses) {
    if (reqCourse.isRequired) continue;

    const studentCourse = courses.find(
      c => c.courseId === reqCourse.courseId &&
           (c.status === "completed" || c.status === "in_progress") &&
           !courseUsage.has(c.id)
    );

    if (studentCourse) {
      applyCourse(studentCourse, reqCourse);
    }
  }

  // 3. Evaluate course groups
  for (const group of requirement.courseGroups) {
    const groupResult = evaluateCourseGroup(
      group,
      courses,
      courseUsage,
      requirement,
      passingGrades,
      gradeCompare
    );

    courseGroupResults.push(groupResult);

    // Add applied courses from group
    for (const applied of groupResult.appliedCourses) {
      // Update usage
      const existingUsage = courseUsage.get(applied.sourceId) || [];
      if (!existingUsage.includes(requirement.id)) {
        existingUsage.push(requirement.id);
        courseUsage.set(applied.sourceId, existingUsage);
      }

      appliedCourses.push(applied);

      // Update counters
      if (applied.status === "completed") {
        creditsEarned += applied.credits;
        coursesCompleted++;
        if (applied.gradePoints !== null) {
          gpaCredits += applied.credits;
          gpaQualityPoints += applied.credits * applied.gradePoints;
        }
      } else {
        creditsInProgress += applied.credits;
        coursesInProgress++;
      }
    }
  }

  // Calculate requirement status
  const creditsRequired = requirement.minimumCredits ?? 0;
  const coursesRequired = requirement.minimumCourses ?? 0;
  const gpaRequired = requirement.minimumGpa ?? null;
  const gpaActual = gpaCredits > 0
    ? Math.round((gpaQualityPoints / gpaCredits) * 1000) / 1000
    : null;

  // Check completion
  const creditsOk = creditsEarned >= creditsRequired;
  const coursesOk = coursesCompleted >= coursesRequired;
  const allRequiredComplete = missingCourses.length === 0;
  const allGroupsComplete = courseGroupResults.every(g => g.status === "complete");
  const gpaOk = !gpaRequired || (gpaActual !== null && gpaActual >= gpaRequired);

  // Check if we have in-progress that would complete
  const creditsWouldBeOk = (creditsEarned + creditsInProgress) >= creditsRequired;
  const coursesWouldBeOk = (coursesCompleted + coursesInProgress) >= coursesRequired;

  let status: "complete" | "in_progress" | "incomplete" | "not_started";

  if (creditsOk && coursesOk && allRequiredComplete && allGroupsComplete && gpaOk) {
    status = "complete";
  } else if (creditsEarned === 0 && coursesCompleted === 0 && creditsInProgress === 0 && coursesInProgress === 0) {
    status = "not_started";
  } else if (creditsInProgress > 0 || coursesInProgress > 0 || (creditsWouldBeOk && coursesWouldBeOk)) {
    status = "in_progress";
  } else {
    status = "incomplete";
  }

  // Generate warning message if GPA is too low
  if (gpaRequired && gpaActual !== null && gpaActual < gpaRequired) {
    messages.push({
      type: "warning",
      category: "gpa",
      requirementId: requirement.id,
      message: `${requirement.name}: GPA (${gpaActual.toFixed(3)}) is below required ${gpaRequired.toFixed(3)}`,
    });
  }

  return {
    requirementId: requirement.id,
    requirementName: requirement.name,
    categoryId: requirement.categoryId,
    categoryName: requirement.categoryName,
    status,
    creditsRequired,
    creditsEarned,
    creditsInProgress,
    coursesRequired,
    coursesCompleted,
    coursesInProgress,
    gpaRequired,
    gpaActual,
    gpaCredits,
    gpaQualityPoints,
    appliedCourses,
    missingCourses,
    courseGroupResults,
    displayOrder: requirement.displayOrder,
    notes: null,
  };
}

/**
 * Evaluate a course group within a requirement
 */
function evaluateCourseGroup(
  group: RequirementCourseGroup,
  courses: StudentCourse[],
  courseUsage: Map<string, string[]>,
  requirement: DegreeRequirement,
  passingGrades: string[],
  gradeCompare: (g1: string, g2: string) => number
): CourseGroupAuditResult {
  const appliedCourses: AppliedCourse[] = [];

  // Find matching courses
  const matchingCourses: StudentCourse[] = [];

  // First check explicit group courses
  for (const groupCourse of group.courses) {
    const studentCourse = courses.find(
      c => c.courseId === groupCourse.courseId &&
           (c.status === "completed" || c.status === "in_progress")
    );
    if (studentCourse && !courseUsage.has(studentCourse.id)) {
      matchingCourses.push(studentCourse);
    }
  }

  // Then check selection rule
  if (group.selectionRule) {
    for (const studentCourse of courses) {
      if (courseUsage.has(studentCourse.id)) continue;
      if (studentCourse.status !== "completed" && studentCourse.status !== "in_progress") continue;
      if (matchingCourses.some(c => c.id === studentCourse.id)) continue;

      if (courseMatchesRule(studentCourse, group.selectionRule)) {
        matchingCourses.push(studentCourse);
      }
    }
  }

  // Sort by credits earned (prefer completed courses)
  matchingCourses.sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;
    return b.credits - a.credits;
  });

  // Apply courses up to requirement
  let creditsApplied = 0;
  let coursesApplied = 0;

  const creditsRequired = group.minimumCredits ?? 0;
  const coursesRequired = group.minimumCourses ?? 0;

  for (const studentCourse of matchingCourses) {
    // Check if we've met the requirement
    if (creditsApplied >= creditsRequired && coursesApplied >= coursesRequired) {
      break;
    }

    // Check if passing
    const isPassing = studentCourse.grade
      ? passingGrades.includes(studentCourse.grade)
      : studentCourse.status === "in_progress";

    if (!isPassing && studentCourse.status !== "in_progress") {
      continue;
    }

    const applied: AppliedCourse = {
      courseId: studentCourse.courseId,
      courseCode: studentCourse.courseCode,
      courseTitle: studentCourse.courseTitle,
      sourceId: studentCourse.id,
      source: studentCourse.source,
      credits: studentCourse.credits,
      grade: studentCourse.grade,
      gradePoints: studentCourse.gradePoints,
      termId: studentCourse.termId,
      status: studentCourse.status === "in_progress" ? "in_progress" : "completed",
      requirementIds: [requirement.id],
      meetsGradeRequirement: true,
    };

    appliedCourses.push(applied);
    creditsApplied += studentCourse.credits;
    coursesApplied++;

    // Mark as used (will be officially marked by parent)
  }

  // Calculate remaining options
  const remainingOptions: RequirementCourse[] = [];
  if (creditsApplied < creditsRequired || coursesApplied < coursesRequired) {
    for (const groupCourse of group.courses) {
      if (!appliedCourses.some(c => c.courseId === groupCourse.courseId)) {
        remainingOptions.push(groupCourse);
      }
    }
  }

  // Determine status
  const hasCompleted = appliedCourses.some(c => c.status === "completed");
  const hasInProgress = appliedCourses.some(c => c.status === "in_progress");
  const creditsComplete = appliedCourses
    .filter(c => c.status === "completed")
    .reduce((sum, c) => sum + c.credits, 0);
  const coursesComplete = appliedCourses.filter(c => c.status === "completed").length;

  let status: "complete" | "in_progress" | "incomplete" | "not_started";

  if (creditsComplete >= creditsRequired && coursesComplete >= coursesRequired) {
    status = "complete";
  } else if (appliedCourses.length === 0) {
    status = "not_started";
  } else if (hasInProgress || creditsApplied >= creditsRequired) {
    status = "in_progress";
  } else {
    status = "incomplete";
  }

  return {
    groupId: group.id,
    groupName: group.name,
    status,
    coursesRequired,
    coursesApplied,
    creditsRequired,
    creditsApplied,
    appliedCourses,
    remainingOptions,
  };
}

/**
 * Get a summary of degree progress as a simple object
 */
export function getDegreeProgressSummary(audit: DegreeAuditResult): {
  completionPercentage: number;
  creditsEarned: number;
  creditsRequired: number;
  creditsRemaining: number;
  requirementsComplete: number;
  requirementsTotal: number;
  status: string;
  gpaStatus: "ok" | "warning" | "below";
} {
  const creditsRemaining = Math.max(0, audit.totalCreditsRequired - audit.totalCreditsEarned);
  const requirementsComplete = audit.requirements.filter(r => r.status === "complete").length;

  let gpaStatus: "ok" | "warning" | "below" = "ok";
  if (audit.overallGpaRequired && audit.overallGpaActual !== null) {
    if (audit.overallGpaActual < audit.overallGpaRequired) {
      gpaStatus = "below";
    } else if (audit.overallGpaActual < audit.overallGpaRequired + 0.25) {
      gpaStatus = "warning";
    }
  }

  return {
    completionPercentage: audit.completionPercentage,
    creditsEarned: audit.totalCreditsEarned,
    creditsRequired: audit.totalCreditsRequired,
    creditsRemaining,
    requirementsComplete,
    requirementsTotal: audit.requirements.length,
    status: audit.status,
    gpaStatus,
  };
}
