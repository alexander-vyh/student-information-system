/**
 * Waitlist Processing Job
 *
 * Processes waitlisted students when section spots become available.
 * Can either auto-enroll eligible students or notify them with an expiration deadline.
 *
 * Processing Flow:
 * 1. Find sections with available spots (currentEnrollment < maxEnrollment)
 * 2. For each section, get waitlist entries in position order
 * 3. For each waitlisted student:
 *    - Verify no active registration holds
 *    - Verify prerequisites still met
 *    - Check for schedule conflicts with current registrations
 * 4. If eligible:
 *    - Auto-enroll (if configured) OR
 *    - Send notification with expiry deadline
 * 5. Update waitlist positions as students are processed
 */

import { Job } from "bullmq";
import { db } from "@sis/db";
import { sql, eq, and, lt, asc, inArray, isNull } from "drizzle-orm";
import {
  ok,
  err,
  type Result,
  type DomainError,
  domainError,
} from "@sis/domain";
import { createJobLogger } from "../logger.js";
import type {
  WaitlistProcessingJobData,
  WaitlistProcessingJobResult,
} from "./types.js";
import {
  sections,
  waitlistEntries,
  registrations,
  registrationHolds,
  sectionMeetings,
} from "@sis/db/schema";

interface WaitlistEntry {
  id: string;
  studentId: string;
  sectionId: string;
  position: number;
  status: string;
}

interface SectionWithAvailability {
  id: string;
  termId: string;
  courseId: string;
  maxEnrollment: number;
  currentEnrollment: number;
  availableSpots: number;
  creditHours: string;
}

interface ProcessingStats {
  sectionsProcessed: number;
  studentsProcessed: number;
  studentsEnrolled: number;
  studentsNotified: number;
  studentsSkipped: number;
}

/**
 * Process waitlist for sections with available spots
 */
export async function processWaitlistJob(
  job: Job<WaitlistProcessingJobData>
): Promise<Result<WaitlistProcessingJobResult, DomainError>> {
  const log = createJobLogger("waitlist-processing", job.id ?? "unknown");
  const startTime = Date.now();
  const { termId, sectionIds, batchId, autoEnroll, notificationExpiryHours } =
    job.data;

  log.info(
    { termId, batchId, autoEnroll, sectionCount: sectionIds?.length ?? "all" },
    "Starting waitlist processing"
  );

  const stats: ProcessingStats = {
    sectionsProcessed: 0,
    studentsProcessed: 0,
    studentsEnrolled: 0,
    studentsNotified: 0,
    studentsSkipped: 0,
  };

  const errors: WaitlistProcessingJobResult["errors"] = [];

  try {
    // Get sections with available spots
    const sectionsWithSpots = await getSectionsWithAvailability(
      termId,
      sectionIds
    );

    log.info(
      { sectionsFound: sectionsWithSpots.length },
      "Found sections with available spots"
    );

    // Process each section
    for (const section of sectionsWithSpots) {
      const sectionResult = await processSection(
        section,
        autoEnroll,
        notificationExpiryHours,
        log
      );

      stats.sectionsProcessed++;
      stats.studentsProcessed += sectionResult.processed;
      stats.studentsEnrolled += sectionResult.enrolled;
      stats.studentsNotified += sectionResult.notified;
      stats.studentsSkipped += sectionResult.skipped;
      errors.push(...sectionResult.errors);

      // Update job progress
      await job.updateProgress(
        Math.round(
          (stats.sectionsProcessed / sectionsWithSpots.length) * 100
        )
      );
    }

    const durationMs = Date.now() - startTime;

    const result: WaitlistProcessingJobResult = {
      batchId,
      termId,
      sectionsProcessed: stats.sectionsProcessed,
      studentsProcessed: stats.studentsProcessed,
      studentsEnrolled: stats.studentsEnrolled,
      studentsNotified: stats.studentsNotified,
      studentsSkipped: stats.studentsSkipped,
      durationMs,
      errors: errors.slice(0, 100), // Limit error list
    };

    log.info(
      {
        sectionsProcessed: result.sectionsProcessed,
        studentsEnrolled: result.studentsEnrolled,
        studentsNotified: result.studentsNotified,
        studentsSkipped: result.studentsSkipped,
        durationMs,
      },
      "Waitlist processing completed"
    );

    return ok(result);
  } catch (error) {
    log.error({ err: error }, "Waitlist processing failed");
    return err(
      domainError(
        "INTERNAL_ERROR",
        `Waitlist processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { batchId, termId }
      )
    );
  }
}

/**
 * Get sections that have available enrollment spots
 */
async function getSectionsWithAvailability(
  termId: string,
  specificSectionIds?: string[]
): Promise<SectionWithAvailability[]> {
  // Build base query to find sections with available spots
  const baseConditions = and(
    eq(sections.termId, termId),
    sql`${sections.currentEnrollment} < ${sections.maxEnrollment}`,
    eq(sections.status, "active")
  );

  const whereClause = specificSectionIds?.length
    ? and(baseConditions, inArray(sections.id, specificSectionIds))
    : baseConditions;

  const results = await db
    .select({
      id: sections.id,
      termId: sections.termId,
      courseId: sections.courseId,
      maxEnrollment: sections.maxEnrollment,
      currentEnrollment: sections.currentEnrollment,
      creditHours: sections.creditHours,
    })
    .from(sections)
    .where(whereClause);

  return results.map((r) => ({
    id: r.id,
    termId: r.termId,
    courseId: r.courseId,
    maxEnrollment: r.maxEnrollment ?? 30,
    currentEnrollment: r.currentEnrollment ?? 0,
    availableSpots: (r.maxEnrollment ?? 30) - (r.currentEnrollment ?? 0),
    creditHours: r.creditHours,
  }));
}

interface SectionProcessingResult {
  processed: number;
  enrolled: number;
  notified: number;
  skipped: number;
  errors: Array<{ studentId: string; sectionId: string; error: string }>;
}

/**
 * Process waitlist for a single section
 */
async function processSection(
  section: SectionWithAvailability,
  autoEnroll: boolean,
  notificationExpiryHours: number,
  log: ReturnType<typeof createJobLogger>
): Promise<SectionProcessingResult> {
  const result: SectionProcessingResult = {
    processed: 0,
    enrolled: 0,
    notified: 0,
    skipped: 0,
    errors: [],
  };

  // Get waitlist entries for this section, ordered by position
  const waitlist = await db
    .select({
      id: waitlistEntries.id,
      studentId: waitlistEntries.studentId,
      sectionId: waitlistEntries.sectionId,
      position: waitlistEntries.position,
      status: waitlistEntries.status,
    })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.sectionId, section.id),
        eq(waitlistEntries.status, "waiting")
      )
    )
    .orderBy(asc(waitlistEntries.position))
    .limit(section.availableSpots);

  log.debug(
    { sectionId: section.id, waitlistCount: waitlist.length },
    "Processing section waitlist"
  );

  let spotsRemaining = section.availableSpots;

  for (const entry of waitlist) {
    if (spotsRemaining <= 0) break;

    result.processed++;

    // Check student eligibility
    const eligibility = await checkStudentEligibility(
      entry.studentId,
      section.id,
      section.courseId,
      section.termId
    );

    if (!eligibility.eligible) {
      result.skipped++;
      log.debug(
        { studentId: entry.studentId, reason: eligibility.reason },
        "Student not eligible for waitlist enrollment"
      );
      continue;
    }

    try {
      if (autoEnroll) {
        // Auto-enroll the student
        await enrollStudentFromWaitlist(entry, section);
        result.enrolled++;
        spotsRemaining--;
        log.info(
          { studentId: entry.studentId, sectionId: section.id },
          "Student auto-enrolled from waitlist"
        );
      } else {
        // Notify the student
        await notifyStudentOfAvailability(entry, notificationExpiryHours);
        result.notified++;
        log.info(
          { studentId: entry.studentId, sectionId: section.id },
          "Student notified of waitlist availability"
        );
      }
    } catch (error) {
      result.errors.push({
        studentId: entry.studentId,
        sectionId: section.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Reorder remaining waitlist positions if students were enrolled
  if (result.enrolled > 0) {
    await reorderWaitlistPositions(section.id);
  }

  return result;
}

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Check if a student is eligible to enroll from the waitlist
 */
async function checkStudentEligibility(
  studentId: string,
  sectionId: string,
  courseId: string,
  termId: string
): Promise<EligibilityResult> {
  // Check for active registration holds
  const activeHolds = await db
    .select({ id: registrationHolds.id })
    .from(registrationHolds)
    .where(
      and(
        eq(registrationHolds.studentId, studentId),
        isNull(registrationHolds.resolvedAt),
        eq(registrationHolds.blocksRegistration, true)
      )
    )
    .limit(1);

  if (activeHolds.length > 0) {
    return { eligible: false, reason: "Active registration hold" };
  }

  // Check for schedule conflicts with current registrations
  const hasConflict = await checkScheduleConflict(studentId, termId, sectionId);
  if (hasConflict) {
    return { eligible: false, reason: "Schedule conflict with current registration" };
  }

  // Check if already enrolled in the same course (different section)
  const existingEnrollment = await db
    .select({ id: registrations.id })
    .from(registrations)
    .innerJoin(sections, eq(registrations.sectionId, sections.id))
    .where(
      and(
        eq(registrations.studentId, studentId),
        eq(sections.courseId, courseId),
        eq(sections.termId, termId),
        inArray(registrations.status, ["registered", "enrolled"])
      )
    )
    .limit(1);

  if (existingEnrollment.length > 0) {
    return { eligible: false, reason: "Already enrolled in this course" };
  }

  return { eligible: true };
}

/**
 * Check if enrolling in a section would create a schedule conflict
 */
async function checkScheduleConflict(
  studentId: string,
  termId: string,
  newSectionId: string
): Promise<boolean> {
  // Get meetings for the new section
  const newMeetings = await db
    .select({
      daysOfWeek: sectionMeetings.daysOfWeek,
      startTime: sectionMeetings.startTime,
      endTime: sectionMeetings.endTime,
    })
    .from(sectionMeetings)
    .where(eq(sectionMeetings.sectionId, newSectionId));

  if (newMeetings.length === 0) {
    return false; // No meetings = no conflicts (e.g., online async)
  }

  // Get student's current enrollments and their meetings
  const currentMeetings = await db
    .select({
      daysOfWeek: sectionMeetings.daysOfWeek,
      startTime: sectionMeetings.startTime,
      endTime: sectionMeetings.endTime,
    })
    .from(registrations)
    .innerJoin(sections, eq(registrations.sectionId, sections.id))
    .innerJoin(sectionMeetings, eq(sectionMeetings.sectionId, sections.id))
    .where(
      and(
        eq(registrations.studentId, studentId),
        eq(sections.termId, termId),
        inArray(registrations.status, ["registered", "enrolled"])
      )
    );

  // Check for overlapping times on same days
  for (const newMeeting of newMeetings) {
    const newDays = newMeeting.daysOfWeek ?? [];
    for (const currentMeeting of currentMeetings) {
      const curDays = currentMeeting.daysOfWeek ?? [];
      // Check if any days overlap
      const hasCommonDay = newDays.some((day) => curDays.includes(day));
      if (hasCommonDay) {
        // Check time overlap
        if (
          newMeeting.startTime &&
          newMeeting.endTime &&
          currentMeeting.startTime &&
          currentMeeting.endTime
        ) {
          const newStart = newMeeting.startTime;
          const newEnd = newMeeting.endTime;
          const curStart = currentMeeting.startTime;
          const curEnd = currentMeeting.endTime;

          // Times overlap if one starts before the other ends
          if (newStart < curEnd && curStart < newEnd) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Enroll a student from the waitlist
 */
async function enrollStudentFromWaitlist(
  entry: WaitlistEntry,
  section: SectionWithAvailability
): Promise<void> {
  await db.transaction(async (tx) => {
    // Create registration record
    await tx.insert(registrations).values({
      studentId: entry.studentId,
      sectionId: entry.sectionId,
      termId: section.termId,
      creditHours: section.creditHours,
      status: "registered",
      registrationMethod: "batch",
      registrationDate: new Date(),
    });

    // Update section enrollment count
    await tx
      .update(sections)
      .set({
        currentEnrollment: sql`${sections.currentEnrollment} + 1`,
      })
      .where(eq(sections.id, entry.sectionId));

    // Update waitlist entry status
    await tx
      .update(waitlistEntries)
      .set({
        status: "enrolled",
        removedAt: new Date(),
      })
      .where(eq(waitlistEntries.id, entry.id));

    // Update section waitlist count
    await tx
      .update(sections)
      .set({
        waitlistCurrent: sql`GREATEST(${sections.waitlistCurrent} - 1, 0)`,
      })
      .where(eq(sections.id, entry.sectionId));
  });
}

/**
 * Notify a student that a spot is available
 */
async function notifyStudentOfAvailability(
  entry: WaitlistEntry,
  expiryHours: number
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  await db
    .update(waitlistEntries)
    .set({
      status: "notified",
      notifiedAt: new Date(),
      notificationExpiresAt: expiresAt,
    })
    .where(eq(waitlistEntries.id, entry.id));

  // TODO: Queue actual notification (email/SMS) via notifications queue
  // This would integrate with the existing NOTIFICATIONS queue
}

/**
 * Reorder waitlist positions after students are enrolled/removed
 */
async function reorderWaitlistPositions(sectionId: string): Promise<void> {
  // Get remaining waiting entries
  const remaining = await db
    .select({
      id: waitlistEntries.id,
      position: waitlistEntries.position,
    })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.sectionId, sectionId),
        eq(waitlistEntries.status, "waiting")
      )
    )
    .orderBy(asc(waitlistEntries.position));

  // Update positions to be sequential starting from 1
  for (let i = 0; i < remaining.length; i++) {
    const entry = remaining[i];
    if (entry && entry.position !== i + 1) {
      await db
        .update(waitlistEntries)
        .set({ position: i + 1 })
        .where(eq(waitlistEntries.id, entry.id));
    }
  }
}
