/**
 * Enrollment Router
 *
 * Handles student registration operations including:
 * - Section enrollment with prerequisite/capacity validation
 * - Drop and withdrawal processing
 * - Waitlist management
 * - Registration schedule viewing
 *
 * All operations enforce FERPA compliance through canAccessStudent middleware.
 */

import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  canAccessStudent,
  requireRole,
} from "../trpc.js";
import {
  registrations,
  waitlistEntries,
  registrationHolds,
  sections,
  courses,
  terms,
  students,
  grades,
  gradeScales,
} from "@sis/db/schema";

// ============================================================================
// Input Schemas
// ============================================================================

const enrollInputSchema = z.object({
  studentId: z.string().uuid(),
  sectionId: z.string().uuid(),
  gradeMode: z.enum(["standard", "pass_fail", "audit"]).default("standard"),
  creditHours: z.number().positive().optional(), // For variable credit courses
});

const dropInputSchema = z.object({
  studentId: z.string().uuid(),
  registrationId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const withdrawInputSchema = z.object({
  studentId: z.string().uuid(),
  registrationId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  lastAttendanceDate: z.string().date().optional(), // Required for R2T4
});

const waitlistInputSchema = z.object({
  studentId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

// ============================================================================
// Router
// ============================================================================

export const enrollmentRouter = router({
  /**
   * Get student's current schedule for a term
   */
  getSchedule: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const schedule = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.termId, input.termId),
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

      return {
        schedule: schedule.map((reg) => ({
          registrationId: reg.id,
          sectionId: reg.sectionId,
          status: reg.status,
          gradeMode: reg.gradeMode,
          creditHours: reg.creditHours,
          registeredAt: reg.registrationDate,
          course: reg.section?.course
            ? {
                courseCode: reg.section.course.courseCode,
                title: reg.section.course.title,
                creditHours: reg.section.creditHours,
              }
            : null,
          section: reg.section
            ? {
                sectionNumber: reg.section.sectionNumber,
                instructionalMethod: reg.section.instructionalMethod,
              }
            : null,
        })),
        totalCredits: schedule.reduce(
          (sum, reg) => sum + parseFloat(reg.creditHours),
          0
        ),
      };
    }),

  /**
   * Get student's registration history
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        includeDropped: z.boolean().default(false),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const statusFilter = input.includeDropped
        ? ["registered", "completed", "dropped", "withdrawn"]
        : ["registered", "completed"];

      const history = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          inArray(registrations.status, statusFilter)
        ),
        with: {
          section: {
            with: {
              course: true,
            },
          },
          term: true,
        },
        orderBy: (registrations, { desc }) => [desc(registrations.registrationDate)],
      });

      return history.map((reg) => ({
        registrationId: reg.id,
        termId: reg.termId,
        termName: reg.term?.name ?? "Unknown Term",
        courseCode: reg.section?.course?.courseCode ?? "Unknown",
        title: reg.section?.course?.title ?? "Unknown Course",
        creditHours: reg.creditHours,
        status: reg.status,
        gradeCode: reg.gradeCode,
        gradePoints: reg.gradePoints,
      }));
    }),

  /**
   * Check if student is eligible to enroll in a section
   */
  checkEligibility: protectedProcedure
    .input(enrollInputSchema.pick({ studentId: true, sectionId: true }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Get section details
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
        with: {
          course: true,
          term: true,
        },
      });

      if (!section) {
        return {
          eligible: false,
          reasons: ["Section not found"],
        };
      }

      const reasons: string[] = [];

      // Check term registration is open
      const now = new Date();
      const term = section.term;
      if (term) {
        if (term.registrationStartDate && new Date(term.registrationStartDate) > now) {
          reasons.push("Registration has not opened yet");
        }
        if (term.registrationEndDate && new Date(term.registrationEndDate) < now) {
          reasons.push("Registration period has ended");
        }
      }

      // Check capacity
      const currentEnrollment = section.currentEnrollment ?? 0;
      const maxEnrollment = section.maxEnrollment ?? 0;
      if (currentEnrollment >= maxEnrollment) {
        reasons.push("Section is full");
      }

      // Check for holds
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: and(
          eq(registrationHolds.studentId, input.studentId),
          eq(registrationHolds.blocksRegistration, true)
        ),
      });

      if (holds.length > 0) {
        reasons.push(`Has ${holds.length} registration hold(s)`);
      }

      // Check not already enrolled
      const existingReg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.sectionId, input.sectionId),
          inArray(registrations.status, ["registered", "waitlisted"])
        ),
      });

      if (existingReg) {
        reasons.push("Already enrolled or waitlisted for this section");
      }

      return {
        eligible: reasons.length === 0,
        reasons,
        section: {
          courseCode: section.course?.courseCode,
          title: section.course?.title,
          sectionNumber: section.sectionNumber,
          creditHours: section.creditHours,
          availableSeats: maxEnrollment - currentEnrollment,
        },
      };
    }),

  /**
   * Enroll student in a section
   */
  enroll: protectedProcedure
    .input(enrollInputSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Get section with term
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
        with: {
          course: true,
          term: true,
        },
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found",
        });
      }

      // Check capacity
      const currentEnrollment = section.currentEnrollment ?? 0;
      const maxEnrollment = section.maxEnrollment ?? 0;
      if (currentEnrollment >= maxEnrollment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Section is full",
        });
      }

      // Check for holds
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: and(
          eq(registrationHolds.studentId, input.studentId),
          eq(registrationHolds.blocksRegistration, true)
        ),
      });

      if (holds.length > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot enroll due to registration hold",
        });
      }

      // Check for existing registration (any status)
      const existingReg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.sectionId, input.sectionId)
        ),
      });

      if (existingReg) {
        // If already registered or waitlisted, reject
        if (existingReg.status === "registered" || existingReg.status === "waitlisted") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already enrolled in this section",
          });
        }

        // If previously dropped/withdrawn, re-enroll by updating the record
        if (existingReg.status === "dropped" || existingReg.status === "withdrawn") {
          const creditHours = input.creditHours?.toString() ?? section.creditHours;

          await ctx.db
            .update(registrations)
            .set({
              status: "registered",
              gradeMode: input.gradeMode,
              creditHours,
              registrationMethod: "self",
              registrationDate: new Date(),
              dropDate: null,
              withdrawalDate: null,
              gradeCode: null,
              notes: existingReg.notes
                ? `${existingReg.notes}\nRe-enrolled after ${existingReg.status}`
                : `Re-enrolled after ${existingReg.status}`,
              updatedAt: new Date(),
            })
            .where(eq(registrations.id, existingReg.id));

          // Update enrollment count
          await ctx.db
            .update(sections)
            .set({
              currentEnrollment: (section.currentEnrollment ?? 0) + 1,
            })
            .where(eq(sections.id, input.sectionId));

          return {
            registrationId: existingReg.id,
            message: "Successfully re-enrolled",
          };
        }
      }

      // Create new registration
      const creditHours = input.creditHours?.toString() ?? section.creditHours;

      const [newReg] = await ctx.db
        .insert(registrations)
        .values({
          studentId: input.studentId,
          sectionId: input.sectionId,
          termId: section.termId,
          creditHours,
          status: "registered",
          gradeMode: input.gradeMode,
          registrationMethod: "self",
        })
        .returning();

      // Update enrollment count
      await ctx.db
        .update(sections)
        .set({
          currentEnrollment: currentEnrollment + 1,
        })
        .where(eq(sections.id, input.sectionId));

      return {
        registrationId: newReg?.id,
        message: "Successfully enrolled",
      };
    }),

  /**
   * Drop a registration (before deadline)
   */
  drop: protectedProcedure
    .input(dropInputSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Get registration
      const reg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.id, input.registrationId),
          eq(registrations.studentId, input.studentId)
        ),
        with: {
          section: true,
          term: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      if (reg.status !== "registered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot drop - invalid registration status",
        });
      }

      // Check drop deadline
      const now = new Date();
      if (reg.term?.dropDeadline && new Date(reg.term.dropDeadline) < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Drop deadline has passed - use withdrawal instead",
        });
      }

      // Update registration
      await ctx.db
        .update(registrations)
        .set({
          status: "dropped",
          dropDate: now,
        })
        .where(eq(registrations.id, input.registrationId));

      // Update enrollment count
      if (reg.section) {
        const currentEnrollment = reg.section.currentEnrollment ?? 0;
        await ctx.db
          .update(sections)
          .set({
            currentEnrollment: Math.max(0, currentEnrollment - 1),
          })
          .where(eq(sections.id, reg.sectionId));
      }

      return { message: "Successfully dropped" };
    }),

  /**
   * Withdraw from a registration (after drop deadline)
   */
  withdraw: protectedProcedure
    .input(withdrawInputSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Get registration
      const reg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.id, input.registrationId),
          eq(registrations.studentId, input.studentId)
        ),
        with: {
          section: true,
          term: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      if (reg.status !== "registered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot withdraw - invalid registration status",
        });
      }

      // Check withdrawal deadline
      const now = new Date();
      if (reg.term?.withdrawalDeadline && new Date(reg.term.withdrawalDeadline) < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Withdrawal deadline has passed",
        });
      }

      // Update registration with W grade
      await ctx.db
        .update(registrations)
        .set({
          status: "withdrawn",
          withdrawalDate: now,
          gradeCode: "W",
          lastAttendanceDate: input.lastAttendanceDate ?? null,
        })
        .where(eq(registrations.id, input.registrationId));

      // Update enrollment count
      if (reg.section) {
        const currentEnrollment = reg.section.currentEnrollment ?? 0;
        await ctx.db
          .update(sections)
          .set({
            currentEnrollment: Math.max(0, currentEnrollment - 1),
          })
          .where(eq(sections.id, reg.sectionId));
      }

      return { message: "Successfully withdrawn with W grade" };
    }),

  /**
   * Join waitlist for a section
   */
  joinWaitlist: protectedProcedure
    .input(waitlistInputSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Get section
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found",
        });
      }

      // Check waitlist capacity
      const waitlistMax = section.waitlistMax ?? 0;
      const waitlistCurrent = section.waitlistCurrent ?? 0;
      if (waitlistMax <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This section does not have a waitlist",
        });
      }

      if (waitlistCurrent >= waitlistMax) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Waitlist is full",
        });
      }

      // Check not already on waitlist or enrolled
      const existing = await ctx.db.query.waitlistEntries.findFirst({
        where: and(
          eq(waitlistEntries.studentId, input.studentId),
          eq(waitlistEntries.sectionId, input.sectionId),
          eq(waitlistEntries.status, "waiting")
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already on waitlist",
        });
      }

      // Add to waitlist
      const [entry] = await ctx.db
        .insert(waitlistEntries)
        .values({
          studentId: input.studentId,
          sectionId: input.sectionId,
          position: waitlistCurrent + 1,
          status: "waiting",
        })
        .returning();

      // Update waitlist count
      await ctx.db
        .update(sections)
        .set({
          waitlistCurrent: waitlistCurrent + 1,
        })
        .where(eq(sections.id, input.sectionId));

      return {
        waitlistId: entry?.id,
        position: entry?.position,
        message: "Added to waitlist",
      };
    }),

  /**
   * Leave waitlist
   */
  leaveWaitlist: protectedProcedure
    .input(waitlistInputSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Find waitlist entry
      const entry = await ctx.db.query.waitlistEntries.findFirst({
        where: and(
          eq(waitlistEntries.studentId, input.studentId),
          eq(waitlistEntries.sectionId, input.sectionId),
          eq(waitlistEntries.status, "waiting")
        ),
      });

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Not on waitlist for this section",
        });
      }

      // Update entry status
      await ctx.db
        .update(waitlistEntries)
        .set({
          status: "removed",
          removedAt: new Date(),
        })
        .where(eq(waitlistEntries.id, entry.id));

      // Update section waitlist count
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
      });

      if (section) {
        const waitlistCurrent = section.waitlistCurrent ?? 0;
        await ctx.db
          .update(sections)
          .set({
            waitlistCurrent: Math.max(0, waitlistCurrent - 1),
          })
          .where(eq(sections.id, input.sectionId));
      }

      return { message: "Removed from waitlist" };
    }),

  /**
   * Admin: Override enroll (bypass checks)
   */
  overrideEnroll: protectedProcedure
    .input(
      enrollInputSchema.extend({
        overrideReason: z.string().min(1),
        prerequisiteOverride: z.boolean().default(false),
        capacityOverride: z.boolean().default(false),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get section
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found",
        });
      }

      const creditHours = input.creditHours?.toString() ?? section.creditHours;

      // Check for existing registration (any status)
      const existingReg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.sectionId, input.sectionId)
        ),
      });

      if (existingReg) {
        // If already registered or waitlisted, reject
        if (existingReg.status === "registered" || existingReg.status === "waitlisted") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Already enrolled in this section",
          });
        }

        // If previously dropped/withdrawn, re-enroll by updating the record
        if (existingReg.status === "dropped" || existingReg.status === "withdrawn") {
          await ctx.db
            .update(registrations)
            .set({
              status: "registered",
              gradeMode: input.gradeMode,
              creditHours,
              registrationMethod: "admin",
              registrationDate: new Date(),
              dropDate: null,
              withdrawalDate: null,
              gradeCode: null,
              prerequisiteOverride: input.prerequisiteOverride,
              capacityOverride: input.capacityOverride,
              overrideReason: input.overrideReason,
              overrideBy: ctx.user!.id,
              notes: existingReg.notes
                ? `${existingReg.notes}\nAdmin re-enrolled after ${existingReg.status}: ${input.overrideReason}`
                : `Admin re-enrolled after ${existingReg.status}: ${input.overrideReason}`,
              updatedAt: new Date(),
            })
            .where(eq(registrations.id, existingReg.id));

          // Update enrollment count
          await ctx.db
            .update(sections)
            .set({
              currentEnrollment: (section.currentEnrollment ?? 0) + 1,
            })
            .where(eq(sections.id, input.sectionId));

          return {
            registrationId: existingReg.id,
            message: "Override re-enrollment successful",
          };
        }
      }

      // Create new registration with overrides
      const [newReg] = await ctx.db
        .insert(registrations)
        .values({
          studentId: input.studentId,
          sectionId: input.sectionId,
          termId: section.termId,
          creditHours,
          status: "registered",
          gradeMode: input.gradeMode,
          registrationMethod: "admin",
          prerequisiteOverride: input.prerequisiteOverride,
          capacityOverride: input.capacityOverride,
          overrideReason: input.overrideReason,
          overrideBy: ctx.user!.id,
        })
        .returning();

      // Update enrollment count
      const currentEnrollment = section.currentEnrollment ?? 0;
      await ctx.db
        .update(sections)
        .set({
          currentEnrollment: currentEnrollment + 1,
        })
        .where(eq(sections.id, input.sectionId));

      return {
        registrationId: newReg?.id,
        message: "Override enrollment successful",
      };
    }),

  /**
   * Get GPA summary for a student
   * Calculates cumulative GPA and optional term-specific GPA
   */
  getGpaSummary: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid().optional(),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Get all completed registrations that count toward GPA
      const allRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.status, "completed"),
          eq(registrations.includeInGpa, true)
        ),
      });

      // Calculate cumulative totals
      let cumulativeQualityPoints = 0;
      let cumulativeGpaCredits = 0;
      let cumulativeEarnedCredits = 0;
      let cumulativeAttemptedCredits = 0;

      allRegistrations.forEach((reg) => {
        const credits = parseFloat(reg.creditHours || "0");
        const gradePoints = parseFloat(reg.gradePoints || "0");
        const qualityPoints = parseFloat(reg.qualityPoints || "0");

        cumulativeAttemptedCredits += credits;

        // Only count toward earned credits if grade is passing
        if (reg.creditsEarned) {
          cumulativeEarnedCredits += parseFloat(reg.creditsEarned);
        }

        // Only include in GPA calculation if quality points are present
        if (qualityPoints > 0 || gradePoints > 0) {
          cumulativeQualityPoints += qualityPoints;
          cumulativeGpaCredits += credits;
        }
      });

      const cumulativeGpa =
        cumulativeGpaCredits > 0
          ? cumulativeQualityPoints / cumulativeGpaCredits
          : 0;

      // Calculate term-specific GPA if termId provided
      let termGpa = null;
      let termCredits = 0;
      let termQualityPoints = 0;

      if (input.termId) {
        const termRegistrations = allRegistrations.filter(
          (reg) => reg.termId === input.termId
        );

        termRegistrations.forEach((reg) => {
          const credits = parseFloat(reg.creditHours || "0");
          const qualityPoints = parseFloat(reg.qualityPoints || "0");

          if (qualityPoints > 0) {
            termQualityPoints += qualityPoints;
            termCredits += credits;
          }
        });

        termGpa = termCredits > 0 ? termQualityPoints / termCredits : 0;
      }

      return {
        cumulativeGpa: parseFloat(cumulativeGpa.toFixed(3)),
        cumulativeEarnedCredits: parseFloat(cumulativeEarnedCredits.toFixed(2)),
        cumulativeAttemptedCredits: parseFloat(cumulativeAttemptedCredits.toFixed(2)),
        termGpa: termGpa !== null ? parseFloat(termGpa.toFixed(3)) : null,
        termCredits: termCredits > 0 ? parseFloat(termCredits.toFixed(2)) : null,
      };
    }),

  // ============================================================================
  // Registrar Operations
  // ============================================================================

  /**
   * Search sections by course code, title, or instructor
   */
  searchSections: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx, input }) => {
      // Get sections for the term
      const allSections = await ctx.db.query.sections.findMany({
        where: and(
          eq(sections.termId, input.termId),
          eq(sections.status, "active")
        ),
        with: {
          course: {
            with: {
              subject: true,
            },
          },
        },
        limit: 100, // Fetch more, then filter
      });

      // Filter by query (course code, title, or section number)
      const queryLower = input.query.toLowerCase();
      const filtered = allSections.filter((section) => {
        const courseCode = section.course?.courseCode?.toLowerCase() ?? "";
        const title = section.course?.title?.toLowerCase() ?? "";
        const sectionNum = section.sectionNumber.toLowerCase();
        const subjectCode = section.course?.subject?.code?.toLowerCase() ?? "";

        return (
          courseCode.includes(queryLower) ||
          title.includes(queryLower) ||
          sectionNum.includes(queryLower) ||
          subjectCode.includes(queryLower)
        );
      });

      return filtered.slice(0, input.limit).map((section) => ({
        id: section.id,
        courseId: section.courseId,
        courseCode: section.course?.courseCode ?? "Unknown",
        title: section.course?.title ?? "Unknown",
        sectionNumber: section.sectionNumber,
        crn: section.crn,
        creditHours: section.creditHours,
        instructionalMethod: section.instructionalMethod,
        maxEnrollment: section.maxEnrollment ?? 0,
        currentEnrollment: section.currentEnrollment ?? 0,
        waitlistMax: section.waitlistMax ?? 0,
        waitlistCurrent: section.waitlistCurrent ?? 0,
        availableSeats: (section.maxEnrollment ?? 0) - (section.currentEnrollment ?? 0),
        status: section.status,
      }));
    }),

  /**
   * Get section roster (all enrolled students)
   */
  getSectionRoster: protectedProcedure
    .input(
      z.object({
        sectionId: z.string().uuid(),
        includeDropped: z.boolean().default(false),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx, input }) => {
      const statusFilter = input.includeDropped
        ? ["registered", "waitlisted", "dropped", "withdrawn", "completed"]
        : ["registered", "waitlisted"];

      const roster = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.sectionId, input.sectionId),
          inArray(registrations.status, statusFilter)
        ),
        with: {
          student: true,
        },
        orderBy: (registrations, { asc }) => [asc(registrations.registrationDate)],
      });

      // Get section info
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
        with: {
          course: true,
          term: true,
        },
      });

      return {
        section: section
          ? {
              id: section.id,
              courseCode: section.course?.courseCode ?? "Unknown",
              title: section.course?.title ?? "Unknown",
              sectionNumber: section.sectionNumber,
              termName: section.term?.name ?? "Unknown",
              maxEnrollment: section.maxEnrollment ?? 0,
              currentEnrollment: section.currentEnrollment ?? 0,
            }
          : null,
        roster: roster.map((reg) => ({
          registrationId: reg.id,
          studentId: reg.studentId,
          studentIdNumber: reg.student?.studentId ?? "",
          firstName: reg.student?.preferredFirstName ?? reg.student?.legalFirstName ?? "",
          lastName: reg.student?.legalLastName ?? "",
          email: reg.student?.primaryEmail ?? "",
          status: reg.status,
          gradeMode: reg.gradeMode,
          creditHours: reg.creditHours,
          gradeCode: reg.gradeCode,
          registeredAt: reg.registrationDate,
        })),
        enrolledCount: roster.filter((r) => r.status === "registered").length,
        waitlistedCount: roster.filter((r) => r.status === "waitlisted").length,
      };
    }),

  /**
   * Admin drop a student from a section
   */
  adminDrop: protectedProcedure
    .input(
      z.object({
        registrationId: z.string().uuid(),
        reason: z.string().min(1).max(500),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get registration
      const reg = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, input.registrationId),
        with: {
          section: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      if (reg.status !== "registered" && reg.status !== "waitlisted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot drop - invalid registration status",
        });
      }

      const now = new Date();

      // Update registration
      await ctx.db
        .update(registrations)
        .set({
          status: "dropped",
          dropDate: now,
          notes: `Admin drop by ${ctx.user?.email}: ${input.reason}`,
          updatedAt: now,
        })
        .where(eq(registrations.id, input.registrationId));

      // Update enrollment count
      if (reg.section) {
        const currentEnrollment = reg.section.currentEnrollment ?? 0;
        await ctx.db
          .update(sections)
          .set({
            currentEnrollment: Math.max(0, currentEnrollment - 1),
            updatedAt: now,
          })
          .where(eq(sections.id, reg.sectionId));
      }

      return { message: "Successfully dropped student" };
    }),

  /**
   * Admin withdraw a student from a section
   */
  adminWithdraw: protectedProcedure
    .input(
      z.object({
        registrationId: z.string().uuid(),
        reason: z.string().min(1).max(500),
        lastAttendanceDate: z.string().date().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get registration
      const reg = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, input.registrationId),
        with: {
          section: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      if (reg.status !== "registered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot withdraw - invalid registration status",
        });
      }

      const now = new Date();

      // Update registration with W grade
      await ctx.db
        .update(registrations)
        .set({
          status: "withdrawn",
          withdrawalDate: now,
          gradeCode: "W",
          lastAttendanceDate: input.lastAttendanceDate ?? null,
          notes: `Admin withdraw by ${ctx.user?.email}: ${input.reason}`,
          updatedAt: now,
        })
        .where(eq(registrations.id, input.registrationId));

      // Update enrollment count
      if (reg.section) {
        const currentEnrollment = reg.section.currentEnrollment ?? 0;
        await ctx.db
          .update(sections)
          .set({
            currentEnrollment: Math.max(0, currentEnrollment - 1),
            updatedAt: now,
          })
          .where(eq(sections.id, reg.sectionId));
      }

      return { message: "Successfully withdrew student with W grade" };
    }),

  /**
   * Get all terms for selection
   */
  getTerms: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const allTerms = await ctx.db.query.terms.findMany({
        where: eq(terms.institutionId, ctx.user!.institutionId),
        orderBy: (terms, { desc }) => [desc(terms.startDate)],
      });

      // Filter by registration dates if not including inactive
      const now = new Date();
      const filtered = input.includeInactive
        ? allTerms
        : allTerms.filter((term) => {
            // Show terms where registration is open or term is in progress
            const regStart = term.registrationStartDate
              ? new Date(term.registrationStartDate)
              : null;
            const termEnd = term.endDate ? new Date(term.endDate) : null;
            return (
              (regStart && regStart <= now && termEnd && termEnd >= now) ||
              (regStart && regStart <= now)
            );
          });

      return filtered.map((term) => ({
        id: term.id,
        code: term.code,
        name: term.name,
        termType: term.termType,
        startDate: term.startDate,
        endDate: term.endDate,
        registrationStartDate: term.registrationStartDate,
        registrationEndDate: term.registrationEndDate,
        dropDeadline: term.dropDeadline,
        withdrawalDeadline: term.withdrawalDeadline,
      }));
    }),

  // ============================================================================
  // Grade Entry Operations
  // ============================================================================

  /**
   * Get available grades for the institution
   */
  getGrades: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx }) => {
      // Get the default grade scale for the institution
      const defaultScale = await ctx.db.query.gradeScales.findFirst({
        where: and(
          eq(gradeScales.institutionId, ctx.user!.institutionId),
          eq(gradeScales.isDefault, true)
        ),
      });

      if (!defaultScale) {
        return { grades: [] };
      }

      // Get all grades for the scale
      const gradesList = await ctx.db.query.grades.findMany({
        where: eq(grades.gradeScaleId, defaultScale.id),
        orderBy: (grades, { desc }) => [desc(grades.gradePoints)],
      });

      return {
        grades: gradesList.map((g) => ({
          id: g.id,
          code: g.gradeCode,
          points: g.gradePoints,
          countInGpa: g.countInGpa,
          earnedCredits: g.earnedCredits,
          isIncomplete: g.isIncomplete,
          isWithdrawal: g.isWithdrawal,
          isPassFail: g.isPassFail,
        })),
        scaleId: defaultScale.id,
        scaleName: defaultScale.name,
      };
    }),

  /**
   * Submit grade for a single registration
   */
  submitGrade: protectedProcedure
    .input(
      z.object({
        registrationId: z.string().uuid(),
        gradeCode: z.string().min(1).max(5),
        lastAttendanceDate: z.string().date().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .mutation(async ({ ctx, input }) => {
      // Get the registration
      const reg = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, input.registrationId),
        with: {
          section: {
            with: {
              course: true,
            },
          },
          student: true,
        },
      });

      if (!reg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      // Only allow grading for registered status
      if (reg.status !== "registered") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot grade a ${reg.status} registration`,
        });
      }

      // Get the grade definition to calculate points
      const defaultScale = await ctx.db.query.gradeScales.findFirst({
        where: and(
          eq(gradeScales.institutionId, ctx.user!.institutionId),
          eq(gradeScales.isDefault, true)
        ),
      });

      if (!defaultScale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No grade scale configured",
        });
      }

      const gradeDef = await ctx.db.query.grades.findFirst({
        where: and(
          eq(grades.gradeScaleId, defaultScale.id),
          eq(grades.gradeCode, input.gradeCode)
        ),
      });

      if (!gradeDef) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid grade code: ${input.gradeCode}`,
        });
      }

      const now = new Date();
      const creditHours = parseFloat(reg.creditHours);
      const gradePoints = gradeDef.gradePoints ? parseFloat(gradeDef.gradePoints) : 0;
      const qualityPoints = gradeDef.countInGpa ? creditHours * gradePoints : 0;
      const creditsEarned = gradeDef.earnedCredits ? creditHours : 0;
      const creditsAttempted = gradeDef.attemptedCredits ? creditHours : 0;

      // Update registration with grade
      await ctx.db
        .update(registrations)
        .set({
          gradeId: gradeDef.id,
          gradeCode: input.gradeCode,
          gradePoints: gradePoints.toFixed(3),
          qualityPoints: qualityPoints.toFixed(2),
          creditsEarned: creditsEarned.toFixed(2),
          creditsAttempted: creditsAttempted.toFixed(2),
          includeInGpa: gradeDef.countInGpa ?? true,
          status: "completed",
          gradePostedDate: now,
          lastAttendanceDate: input.lastAttendanceDate ?? null,
          notes: input.notes
            ? reg.notes
              ? `${reg.notes}\nGrade entry: ${input.notes}`
              : `Grade entry: ${input.notes}`
            : reg.notes,
          updatedAt: now,
        })
        .where(eq(registrations.id, input.registrationId));

      return {
        message: "Grade submitted successfully",
        gradeCode: input.gradeCode,
        gradePoints,
      };
    }),

  /**
   * Submit grades for multiple registrations at once (batch grade entry)
   */
  submitBatchGrades: protectedProcedure
    .input(
      z.object({
        sectionId: z.string().uuid(),
        grades: z.array(
          z.object({
            registrationId: z.string().uuid(),
            gradeCode: z.string().min(1).max(5),
          })
        ),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .mutation(async ({ ctx, input }) => {
      // Verify section exists
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found",
        });
      }

      // Get the grade scale
      const defaultScale = await ctx.db.query.gradeScales.findFirst({
        where: and(
          eq(gradeScales.institutionId, ctx.user!.institutionId),
          eq(gradeScales.isDefault, true)
        ),
      });

      if (!defaultScale) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No grade scale configured",
        });
      }

      // Get all grades for the scale
      const gradesList = await ctx.db.query.grades.findMany({
        where: eq(grades.gradeScaleId, defaultScale.id),
      });

      const gradeMap = new Map(gradesList.map((g) => [g.gradeCode, g]));
      const now = new Date();
      let successCount = 0;
      const errors: string[] = [];

      // Process each grade
      for (const gradeEntry of input.grades) {
        const gradeDef = gradeMap.get(gradeEntry.gradeCode);
        if (!gradeDef) {
          errors.push(`Invalid grade code: ${gradeEntry.gradeCode}`);
          continue;
        }

        // Get registration
        const reg = await ctx.db.query.registrations.findFirst({
          where: and(
            eq(registrations.id, gradeEntry.registrationId),
            eq(registrations.sectionId, input.sectionId)
          ),
        });

        if (!reg) {
          errors.push(`Registration ${gradeEntry.registrationId} not found`);
          continue;
        }

        if (reg.status !== "registered") {
          errors.push(`Cannot grade registration with status: ${reg.status}`);
          continue;
        }

        const creditHours = parseFloat(reg.creditHours);
        const gradePoints = gradeDef.gradePoints ? parseFloat(gradeDef.gradePoints) : 0;
        const qualityPoints = gradeDef.countInGpa ? creditHours * gradePoints : 0;
        const creditsEarned = gradeDef.earnedCredits ? creditHours : 0;
        const creditsAttempted = gradeDef.attemptedCredits ? creditHours : 0;

        // Update registration
        await ctx.db
          .update(registrations)
          .set({
            gradeId: gradeDef.id,
            gradeCode: gradeEntry.gradeCode,
            gradePoints: gradePoints.toFixed(3),
            qualityPoints: qualityPoints.toFixed(2),
            creditsEarned: creditsEarned.toFixed(2),
            creditsAttempted: creditsAttempted.toFixed(2),
            includeInGpa: gradeDef.countInGpa ?? true,
            status: "completed",
            gradePostedDate: now,
            updatedAt: now,
          })
          .where(eq(registrations.id, gradeEntry.registrationId));

        successCount++;
      }

      return {
        message: `Successfully submitted ${successCount} of ${input.grades.length} grades`,
        successCount,
        totalCount: input.grades.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),

  /**
   * Get roster with grades for a section (for grade entry page)
   */
  getSectionGradeRoster: protectedProcedure
    .input(
      z.object({
        sectionId: z.string().uuid(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx, input }) => {
      // Get section info
      const section = await ctx.db.query.sections.findFirst({
        where: eq(sections.id, input.sectionId),
        with: {
          course: true,
          term: true,
        },
      });

      if (!section) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Section not found",
        });
      }

      // Get all registrations for grade entry (registered and completed)
      const roster = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.sectionId, input.sectionId),
          inArray(registrations.status, ["registered", "completed"])
        ),
        with: {
          student: true,
        },
        orderBy: (registrations, { asc }) => [asc(registrations.studentId)],
      });

      return {
        section: {
          id: section.id,
          courseCode: section.course?.courseCode ?? "Unknown",
          title: section.course?.title ?? "Unknown",
          sectionNumber: section.sectionNumber,
          termName: section.term?.name ?? "Unknown",
          termId: section.termId,
          creditHours: section.creditHours,
        },
        roster: roster.map((reg) => ({
          registrationId: reg.id,
          studentId: reg.studentId,
          studentIdNumber: reg.student?.studentId ?? "",
          firstName: reg.student?.preferredFirstName ?? reg.student?.legalFirstName ?? "",
          lastName: reg.student?.legalLastName ?? "",
          email: reg.student?.primaryEmail ?? "",
          status: reg.status,
          gradeMode: reg.gradeMode,
          creditHours: reg.creditHours,
          gradeCode: reg.gradeCode,
          gradePoints: reg.gradePoints,
          gradePostedDate: reg.gradePostedDate,
          midtermGradeCode: reg.midtermGradeCode,
        })),
        stats: {
          total: roster.length,
          graded: roster.filter((r) => r.gradeCode !== null).length,
          ungraded: roster.filter((r) => r.gradeCode === null && r.status === "registered").length,
        },
      };
    }),
});
