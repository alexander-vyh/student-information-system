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

      // Check not already enrolled
      const existingReg = await ctx.db.query.registrations.findFirst({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.sectionId, input.sectionId),
          inArray(registrations.status, ["registered", "waitlisted"])
        ),
      });

      if (existingReg) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already enrolled in this section",
        });
      }

      // Create registration
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

      // Create registration with overrides
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
});
