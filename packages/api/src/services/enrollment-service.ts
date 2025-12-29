/**
 * Enrollment Service
 *
 * Business logic for course enrollment operations.
 * Extracted from routers for testability and reuse.
 *
 * Design:
 * - Returns Result<T, EnrollmentError> instead of throwing
 * - Can be unit tested without tRPC context
 * - Uses typed errors from @sis/api/errors
 *
 * Usage in router:
 *   const service = new EnrollmentService(ctx.db);
 *   const result = await service.enroll(input);
 *   if (!result.ok) throw mapToTRPC(result.error);
 *   return result.value;
 */

import { eq, and, inArray, isNull } from "drizzle-orm";
import type { db } from "@sis/db";
import {
  registrations,
  sections,
  courseRequisites,
  sectionMeetings,
  registrationHolds,
} from "@sis/db/schema";
import { ok, err, type Result } from "@sis/domain/common";
import type {
  EnrollmentError,
  SectionFullError,
  PrerequisiteNotMetError,
  HoldBlockingError,
  ScheduleConflictError,
  AlreadyEnrolledError,
  SectionNotFoundError,
  StudentNotFoundError,
  EnrollmentClosedError,
} from "../errors/types.js";

// =============================================================================
// Types
// =============================================================================

type Database = typeof db;

export interface EnrollInput {
  studentId: string;
  sectionId: string;
  gradeMode?: "standard" | "pass_fail" | "audit";
  creditHours?: string;
}

export interface EnrollResult {
  registrationId: string;
  status: "registered" | "waitlisted";
  message: string;
}

export interface DropInput {
  registrationId: string;
  reason?: string;
}

export interface DropResult {
  success: true;
  message: string;
}

export interface EligibilityCheckResult {
  eligible: boolean;
  errors: EnrollmentError[];
  section: {
    courseCode: string | null;
    title: string | null;
    sectionNumber: string;
    creditHours: string;
    availableSeats: number;
  } | null;
}

export interface PrerequisiteCheckResult {
  met: boolean;
  missing: Array<{
    type: "course" | "credits" | "standing" | "permission";
    description: string;
    courseCode?: string;
    minimumGrade?: string;
  }>;
}

export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    existingSectionId: string;
    existingCourseCode: string;
    conflictingDay: string;
    existingTime: string;
    newTime: string;
    registrationId: string;
  }>;
}

// =============================================================================
// Service Class
// =============================================================================

export class EnrollmentService {
  constructor(private db: Database) {}

  // ---------------------------------------------------------------------------
  // Main Operations
  // ---------------------------------------------------------------------------

  /**
   * Check if a student is eligible to enroll in a section.
   * Returns all eligibility issues (not just the first one).
   */
  async checkEligibility(
    studentId: string,
    sectionId: string,
    termId?: string
  ): Promise<Result<EligibilityCheckResult, EnrollmentError>> {
    const errors: EnrollmentError[] = [];

    // Get section with course and term
    const section = await this.db.query.sections.findFirst({
      where: eq(sections.id, sectionId),
      with: {
        course: true,
        term: true,
      },
    });

    if (!section) {
      return err({
        code: "SECTION_NOT_FOUND",
        sectionId,
      } satisfies SectionNotFoundError);
    }

    const effectiveTermId = termId ?? section.termId;

    // Check enrollment period
    const enrollmentPeriodResult = await this.checkEnrollmentPeriod(
      effectiveTermId
    );
    if (!enrollmentPeriodResult.ok) {
      errors.push(enrollmentPeriodResult.error);
    }

    // Check capacity
    const capacityResult = this.checkCapacity(section);
    if (!capacityResult.ok) {
      errors.push(capacityResult.error);
    }

    // Check for blocking holds
    const holdsResult = await this.checkBlockingHolds(studentId);
    if (!holdsResult.ok) {
      errors.push(holdsResult.error);
    }

    // Check not already enrolled
    const duplicateResult = await this.checkNotAlreadyEnrolled(
      studentId,
      sectionId,
      section.course?.id
    );
    if (!duplicateResult.ok) {
      errors.push(duplicateResult.error);
    }

    // Check prerequisites
    if (section.course?.id) {
      const prereqResult = await this.checkPrerequisites(
        studentId,
        section.course.id
      );
      if (!prereqResult.ok) {
        errors.push(prereqResult.error);
      }
    }

    // Check schedule conflicts
    const conflictResult = await this.checkScheduleConflicts(
      studentId,
      effectiveTermId,
      sectionId
    );
    if (!conflictResult.ok) {
      errors.push(conflictResult.error);
    }

    const maxEnrollment = section.maxEnrollment ?? 0;
    const currentEnrollment = section.currentEnrollment ?? 0;

    return ok({
      eligible: errors.length === 0,
      errors,
      section: {
        courseCode: section.course?.courseCode ?? null,
        title: section.course?.title ?? null,
        sectionNumber: section.sectionNumber,
        creditHours: section.creditHours,
        availableSeats: Math.max(0, maxEnrollment - currentEnrollment),
      },
    });
  }

  /**
   * Enroll a student in a section.
   * Performs all eligibility checks first.
   */
  async enroll(
    input: EnrollInput
  ): Promise<Result<EnrollResult, EnrollmentError>> {
    const { studentId, sectionId, gradeMode, creditHours } = input;

    // Get section with term
    const section = await this.db.query.sections.findFirst({
      where: eq(sections.id, sectionId),
      with: {
        course: true,
        term: true,
      },
    });

    if (!section) {
      return err({
        code: "SECTION_NOT_FOUND",
        sectionId,
      } satisfies SectionNotFoundError);
    }

    // Check enrollment period
    const periodResult = await this.checkEnrollmentPeriod(section.termId);
    if (!periodResult.ok) {
      return periodResult;
    }

    // Check for blocking holds
    const holdsResult = await this.checkBlockingHolds(studentId);
    if (!holdsResult.ok) {
      return holdsResult;
    }

    // Check not already enrolled
    const duplicateResult = await this.checkNotAlreadyEnrolled(
      studentId,
      sectionId,
      section.course?.id
    );
    if (!duplicateResult.ok) {
      return duplicateResult;
    }

    // Check prerequisites
    if (section.course?.id) {
      const prereqResult = await this.checkPrerequisites(
        studentId,
        section.course.id
      );
      if (!prereqResult.ok) {
        return prereqResult;
      }
    }

    // Check schedule conflicts
    const conflictResult = await this.checkScheduleConflicts(
      studentId,
      section.termId,
      sectionId
    );
    if (!conflictResult.ok) {
      return conflictResult;
    }

    // Check capacity
    const currentEnrollment = section.currentEnrollment ?? 0;
    const maxEnrollment = section.maxEnrollment ?? 0;
    const isFull = currentEnrollment >= maxEnrollment;

    if (isFull) {
      return err({
        code: "SECTION_FULL",
        sectionId,
        currentEnrollment,
        capacity: maxEnrollment,
        waitlistAvailable: false, // TODO: Add waitlist support
      } satisfies SectionFullError);
    }

    // Create registration
    const effectiveCreditHours = creditHours ?? section.creditHours;

    const result = await this.db
      .insert(registrations)
      .values({
        studentId,
        sectionId,
        termId: section.termId,
        status: "registered",
        gradeMode: gradeMode ?? "standard",
        creditHours: effectiveCreditHours,
        registrationDate: new Date(),
      })
      .returning({ id: registrations.id });

    const registration = result[0];
    if (!registration) {
      return err({
        code: "SECTION_NOT_FOUND",
        sectionId,
        message: "Failed to create registration",
      } satisfies SectionNotFoundError);
    }

    // Update section enrollment count
    await this.db
      .update(sections)
      .set({ currentEnrollment: currentEnrollment + 1 })
      .where(eq(sections.id, sectionId));

    return ok({
      registrationId: registration.id,
      status: "registered" as const,
      message: `Successfully enrolled in ${section.course?.courseCode ?? "course"}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Validation Checks (Return Result types)
  // ---------------------------------------------------------------------------

  /**
   * Check if enrollment period is open for the term.
   */
  async checkEnrollmentPeriod(
    termId: string
  ): Promise<Result<void, EnrollmentClosedError>> {
    const term = await this.db.query.terms.findFirst({
      where: eq(
        (
          await import("@sis/db/schema")
        ).terms.id,
        termId
      ),
    });

    if (!term) {
      return ok(undefined); // No term = no restriction
    }

    const now = new Date();

    if (
      term.registrationStartDate &&
      new Date(term.registrationStartDate) > now
    ) {
      return err({
        code: "ENROLLMENT_CLOSED",
        termId,
        enrollmentStart: term.registrationStartDate,
        reason: "before_start",
      });
    }

    if (term.registrationEndDate && new Date(term.registrationEndDate) < now) {
      return err({
        code: "ENROLLMENT_CLOSED",
        termId,
        enrollmentEnd: term.registrationEndDate,
        reason: "after_end",
      });
    }

    return ok(undefined);
  }

  /**
   * Check section capacity.
   */
  checkCapacity(section: {
    id: string;
    currentEnrollment: number | null;
    maxEnrollment: number | null;
  }): Result<void, SectionFullError> {
    const current = section.currentEnrollment ?? 0;
    const max = section.maxEnrollment ?? 0;

    if (current >= max) {
      return err({
        code: "SECTION_FULL",
        sectionId: section.id,
        currentEnrollment: current,
        capacity: max,
        waitlistAvailable: false, // TODO: Add waitlist support when schema has waitlist fields
      });
    }

    return ok(undefined);
  }

  /**
   * Check for holds that block registration.
   */
  async checkBlockingHolds(
    studentId: string
  ): Promise<Result<void, HoldBlockingError>> {
    const holds = await this.db.query.registrationHolds.findMany({
      where: and(
        eq(registrationHolds.studentId, studentId),
        eq(registrationHolds.blocksRegistration, true),
        isNull(registrationHolds.resolvedAt)
      ),
    });

    if (holds.length > 0) {
      return err({
        code: "HOLD_BLOCKING",
        holds: holds.map((h) => ({
          holdId: h.id,
          holdCode: h.holdCode,
          holdName: h.holdName,
          holdType: (h.holdType as "financial" | "academic" | "administrative" | "disciplinary") ?? "administrative",
          releaseAuthority: h.releaseAuthority ?? "Registrar",
          resolutionInstructions: undefined,
        })),
      });
    }

    return ok(undefined);
  }

  /**
   * Check if student is already enrolled in this section or course.
   */
  async checkNotAlreadyEnrolled(
    studentId: string,
    sectionId: string,
    courseId?: string
  ): Promise<Result<void, AlreadyEnrolledError>> {
    // Check same section
    const existingReg = await this.db.query.registrations.findFirst({
      where: and(
        eq(registrations.studentId, studentId),
        eq(registrations.sectionId, sectionId),
        inArray(registrations.status, ["registered", "waitlisted"])
      ),
      with: {
        section: {
          with: { course: true },
        },
      },
    });

    if (existingReg) {
      return err({
        code: "ALREADY_ENROLLED",
        existingRegistrationId: existingReg.id,
        existingStatus: existingReg.status as "registered" | "waitlisted",
        courseCode: existingReg.section?.course?.courseCode ?? "Unknown",
        sectionNumber: existingReg.section?.sectionNumber ?? "Unknown",
      });
    }

    return ok(undefined);
  }

  /**
   * Check course prerequisites.
   */
  async checkPrerequisites(
    studentId: string,
    courseId: string
  ): Promise<Result<void, PrerequisiteNotMetError>> {
    const requisites = await this.db.query.courseRequisites.findMany({
      where: and(
        eq(courseRequisites.courseId, courseId),
        eq(courseRequisites.requisiteType, "prerequisite"),
        eq(courseRequisites.isActive, true)
      ),
      with: {
        requisiteCourse: true,
      },
    });

    if (requisites.length === 0) {
      return ok(undefined);
    }

    const missing: PrerequisiteNotMetError["missing"] = [];

    for (const req of requisites) {
      if (req.requisiteCourseId && req.requisiteCourse) {
        // Check if student has completed this prerequisite
        const completed = await this.db.query.registrations.findFirst({
          where: and(
            eq(registrations.studentId, studentId),
            eq(registrations.status, "completed")
          ),
          with: {
            section: true,
          },
        });

        // Simple check - look for completed course in any section
        const hasCompleted = completed?.section?.courseId === req.requisiteCourseId;

        if (!hasCompleted) {
          missing.push({
            requisiteType: "prerequisite",
            courseCode: req.requisiteCourse.courseCode ?? "Unknown",
            courseName: req.requisiteCourse.title ?? "Unknown Course",
            description:
              req.description ??
              `Complete ${req.requisiteCourse.courseCode}${req.minimumGrade ? ` with grade ${req.minimumGrade} or better` : ""}`,
            canBeTakenConcurrently: false,
          });
        }
      }
    }

    if (missing.length > 0) {
      return err({
        code: "PREREQUISITE_NOT_MET",
        courseId,
        missing,
      });
    }

    return ok(undefined);
  }

  /**
   * Check for schedule conflicts with existing registrations.
   */
  async checkScheduleConflicts(
    studentId: string,
    termId: string,
    newSectionId: string
  ): Promise<Result<void, ScheduleConflictError>> {
    // Get new section's meeting times
    const newMeetings = await this.db.query.sectionMeetings.findMany({
      where: eq(sectionMeetings.sectionId, newSectionId),
    });

    if (newMeetings.length === 0) {
      return ok(undefined); // No meeting times = async/online
    }

    // Get existing registrations
    const existingRegs = await this.db.query.registrations.findMany({
      where: and(
        eq(registrations.studentId, studentId),
        eq(registrations.termId, termId),
        eq(registrations.status, "registered")
      ),
      with: {
        section: {
          with: { course: true },
        },
      },
    });

    const conflicts: ScheduleConflictError["conflicts"] = [];

    for (const reg of existingRegs) {
      if (!reg.section) continue;

      const existingMeetings = await this.db.query.sectionMeetings.findMany({
        where: eq(sectionMeetings.sectionId, reg.sectionId),
      });

      for (const existing of existingMeetings) {
        for (const newMeeting of newMeetings) {
          if (
            !existing.daysOfWeek ||
            !newMeeting.daysOfWeek ||
            !existing.startTime ||
            !existing.endTime ||
            !newMeeting.startTime ||
            !newMeeting.endTime
          ) {
            continue;
          }

          const existingDays = existing.daysOfWeek as string[];
          const newDays = newMeeting.daysOfWeek as string[];
          const overlappingDays = existingDays.filter((d) =>
            newDays.includes(d)
          );

          if (overlappingDays.length === 0) continue;

          if (
            this.timesOverlap(
              existing.startTime,
              existing.endTime,
              newMeeting.startTime,
              newMeeting.endTime
            )
          ) {
            conflicts.push({
              sectionId: reg.sectionId,
              courseCode: reg.section.course?.courseCode ?? "Unknown",
              courseName: reg.section.course?.title ?? "Unknown",
              meetingDays: overlappingDays.join(", "),
              startTime: existing.startTime,
              endTime: existing.endTime,
              registrationId: reg.id,
            });
          }
        }
      }
    }

    if (conflicts.length > 0) {
      return err({
        code: "SCHEDULE_CONFLICT",
        requestedSectionId: newSectionId,
        conflicts,
      });
    }

    return ok(undefined);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Check if two time ranges overlap.
   */
  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const toMinutes = (time: string): number => {
      const parts = time.split(":");
      const hours = parseInt(parts[0] ?? "0", 10);
      const minutes = parseInt(parts[1] ?? "0", 10);
      return hours * 60 + minutes;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    return s1 < e2 && s2 < e1;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an EnrollmentService instance.
 * Useful for dependency injection in tests.
 */
export function createEnrollmentService(db: Database): EnrollmentService {
  return new EnrollmentService(db);
}
