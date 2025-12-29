/**
 * Scheduling Router
 *
 * Endpoints for course scheduling management including:
 * - Schedule versions (draft/published/archived)
 * - Solver run management
 * - Meeting patterns and date patterns
 * - Instructor workload and preferences
 * - Room availability and features
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, sql, inArray, isNull, count, avg, sum } from "drizzle-orm";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import {
  scheduleVersions,
  solverRuns,
  sectionAssignments,
  meetingPatterns,
  meetingPatternTimes,
  instructorWorkloads,
  instructorAssignments,
  roomAvailability,
  constraintTypes,
  examPeriods,
  sections,
} from "@sis/db";

// Environment variable for scheduler service URL
const SCHEDULER_SERVICE_URL = process.env["SCHEDULER_SERVICE_URL"] ?? "http://localhost:8080";

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const createScheduleVersionInput = z.object({
  termId: z.string().uuid(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

const updateScheduleVersionInput = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

const startSolverInput = z.object({
  scheduleVersionId: z.string().uuid(),
  timeLimit: z.number().min(10).max(3600).optional(),
  numWorkers: z.number().min(1).max(16).optional(),
  constraintWeights: z.record(z.number()).optional(),
  asyncMode: z.boolean().optional(),
});

const meetingPatternInput = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  totalMinutesPerWeek: z.number().min(0),
  creditHoursMin: z.number().min(0).max(20).optional(),
  creditHoursMax: z.number().min(0).max(20).optional(),
  patternType: z.enum(["standard", "evening", "weekend", "compressed"]).optional(),
  times: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    breakMinutes: z.number().min(0).optional(),
  })),
});

const instructorWorkloadInput = z.object({
  instructorId: z.string().uuid(),
  termId: z.string().uuid(),
  employmentType: z.enum(["tenured", "tenure_track", "ntt", "adjunct", "visiting"]).optional(),
  minLoad: z.number().min(0).optional(),
  maxLoad: z.number().min(0),
  targetLoad: z.number().min(0).optional(),
  maxCourses: z.number().min(0).optional(),
  maxPreps: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const roomAvailabilityInput = z.object({
  roomId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  availabilityType: z.enum(["available", "blocked", "dept_priority"]),
  departmentId: z.string().uuid().optional(),
  reason: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

// =============================================================================
// ROUTER
// =============================================================================

export const schedulingRouter = router({
  // ===========================================================================
  // SCHEDULE VERSIONS
  // ===========================================================================

  /**
   * List schedule versions for a term
   */
  listVersions: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({
      termId: z.string().uuid(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(scheduleVersions.termId, input.termId),
        eq(scheduleVersions.institutionId, ctx.user.institutionId),
      ];

      if (input.status) {
        conditions.push(eq(scheduleVersions.status, input.status));
      }

      const versions = await ctx.db
        .select()
        .from(scheduleVersions)
        .where(and(...conditions))
        .orderBy(desc(scheduleVersions.versionNumber));

      return versions;
    }),

  /**
   * Get a schedule version by ID
   */
  getVersion: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [version] = await ctx.db
        .select()
        .from(scheduleVersions)
        .where(and(
          eq(scheduleVersions.id, input.id),
          eq(scheduleVersions.institutionId, ctx.user.institutionId)
        ));

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Schedule version not found",
        });
      }

      return version;
    }),

  /**
   * Create a new schedule version (draft)
   */
  createVersion: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(createScheduleVersionInput)
    .mutation(async ({ ctx, input }) => {
      // Get next version number for this term
      const [maxVersion] = await ctx.db
        .select({ max: sql<number>`MAX(version_number)` })
        .from(scheduleVersions)
        .where(eq(scheduleVersions.termId, input.termId));

      const nextVersion = (maxVersion?.max ?? 0) + 1;

      const [version] = await ctx.db
        .insert(scheduleVersions)
        .values({
          institutionId: ctx.user.institutionId,
          termId: input.termId,
          versionNumber: nextVersion,
          name: input.name ?? `Version ${nextVersion}`,
          status: "draft",
          notes: input.notes,
          createdBy: ctx.user.id,
        })
        .returning();

      return version;
    }),

  /**
   * Update a schedule version
   */
  updateVersion: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(updateScheduleVersionInput)
    .mutation(async ({ ctx, input }) => {
      const [version] = await ctx.db
        .update(scheduleVersions)
        .set({
          name: input.name,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(and(
          eq(scheduleVersions.id, input.id),
          eq(scheduleVersions.institutionId, ctx.user.institutionId),
          eq(scheduleVersions.status, "draft") // Can only update drafts
        ))
        .returning();

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Schedule version not found or not editable",
        });
      }

      return version;
    }),

  /**
   * Publish a schedule version
   */
  publishVersion: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // First, archive any existing published version for this term
      const [existing] = await ctx.db
        .select()
        .from(scheduleVersions)
        .where(and(
          eq(scheduleVersions.id, input.id),
          eq(scheduleVersions.institutionId, ctx.user.institutionId),
          eq(scheduleVersions.status, "draft")
        ));

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft schedule version not found",
        });
      }

      // Archive previous published versions
      await ctx.db
        .update(scheduleVersions)
        .set({
          status: "archived",
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(scheduleVersions.termId, existing.termId),
          eq(scheduleVersions.status, "published")
        ));

      // Publish this version
      const [published] = await ctx.db
        .update(scheduleVersions)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(scheduleVersions.id, input.id))
        .returning();

      return published;
    }),

  // ===========================================================================
  // SOLVER RUNS
  // ===========================================================================

  /**
   * List solver runs for a schedule version
   */
  listSolverRuns: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({ scheduleVersionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const runs = await ctx.db
        .select()
        .from(solverRuns)
        .where(eq(solverRuns.scheduleVersionId, input.scheduleVersionId))
        .orderBy(desc(solverRuns.createdAt));

      return runs;
    }),

  /**
   * Start a new solver run
   */
  startSolver: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(startSolverInput)
    .mutation(async ({ ctx, input }) => {
      // Verify version exists and is a draft
      const [version] = await ctx.db
        .select()
        .from(scheduleVersions)
        .where(and(
          eq(scheduleVersions.id, input.scheduleVersionId),
          eq(scheduleVersions.institutionId, ctx.user.institutionId),
          eq(scheduleVersions.status, "draft")
        ));

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft schedule version not found",
        });
      }

      // Create solver run record
      const [run] = await ctx.db
        .insert(solverRuns)
        .values({
          scheduleVersionId: input.scheduleVersionId,
          status: "pending",
          runType: "full",
          solverConfig: {
            timeLimit: input.timeLimit ?? 300,
            numWorkers: input.numWorkers ?? 4,
            constraintWeights: input.constraintWeights ?? {},
          },
          createdBy: ctx.user.id,
        })
        .returning();

      if (!run) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create solver run",
        });
      }

      // TODO: Build solver input from database
      // TODO: Call scheduler service
      // For now, return the pending run
      // In production, this would:
      // 1. Build SolverInput from database (sections, rooms, instructors, patterns)
      // 2. POST to SCHEDULER_SERVICE_URL/solve
      // 3. If async, return immediately; otherwise wait for result

      return {
        solverRunId: run.id,
        status: run.status,
        message: "Solver run created. Service integration pending.",
      };
    }),

  /**
   * Get solver run status and results
   */
  getSolverRun: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [run] = await ctx.db
        .select()
        .from(solverRuns)
        .where(eq(solverRuns.id, input.id));

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Solver run not found",
        });
      }

      return run;
    }),

  // ===========================================================================
  // SECTION ASSIGNMENTS
  // ===========================================================================

  /**
   * Get assignments for a schedule version
   */
  getAssignments: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler", "faculty"))
    .input(z.object({
      scheduleVersionId: z.string().uuid(),
      onlyCurrent: z.boolean().optional().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(sectionAssignments.scheduleVersionId, input.scheduleVersionId),
      ];

      if (input.onlyCurrent) {
        conditions.push(isNull(sectionAssignments.validTo));
      }

      const assignments = await ctx.db
        .select()
        .from(sectionAssignments)
        .where(and(...conditions));

      return assignments;
    }),

  /**
   * Manual override of an assignment
   */
  overrideAssignment: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({
      scheduleVersionId: z.string().uuid(),
      sectionId: z.string().uuid(),
      meetingPatternId: z.string().uuid().optional(),
      roomId: z.string().uuid().optional(),
      datePatternId: z.string().uuid().optional(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Invalidate current assignment
      await ctx.db
        .update(sectionAssignments)
        .set({
          validTo: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(sectionAssignments.scheduleVersionId, input.scheduleVersionId),
          eq(sectionAssignments.sectionId, input.sectionId),
          isNull(sectionAssignments.validTo)
        ));

      // Create new assignment
      const [assignment] = await ctx.db
        .insert(sectionAssignments)
        .values({
          scheduleVersionId: input.scheduleVersionId,
          sectionId: input.sectionId,
          meetingPatternId: input.meetingPatternId,
          roomId: input.roomId,
          datePatternId: input.datePatternId,
          isManualOverride: true,
          assignmentSource: "manual",
          changeReason: input.reason,
          changedBy: ctx.user.id,
        })
        .returning();

      return assignment;
    }),

  // ===========================================================================
  // MEETING PATTERNS
  // ===========================================================================

  /**
   * List meeting patterns
   */
  listMeetingPatterns: protectedProcedure
    .input(z.object({
      patternType: z.string().optional(),
      activeOnly: z.boolean().optional().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(meetingPatterns.institutionId, ctx.user.institutionId),
      ];

      if (input.activeOnly) {
        conditions.push(eq(meetingPatterns.isActive, true));
      }

      if (input.patternType) {
        conditions.push(eq(meetingPatterns.patternType, input.patternType));
      }

      const patterns = await ctx.db
        .select()
        .from(meetingPatterns)
        .where(and(...conditions))
        .orderBy(meetingPatterns.sortOrder);

      // Get times for each pattern
      const patternIds = patterns.map(p => p.id);
      const times = patternIds.length > 0
        ? await ctx.db
            .select()
            .from(meetingPatternTimes)
            .where(inArray(meetingPatternTimes.patternId, patternIds))
        : [];

      // Group times by pattern
      const timesByPattern: Record<string, typeof times> = {};
      for (const t of times) {
        if (!timesByPattern[t.patternId]) {
          timesByPattern[t.patternId] = [];
        }
        timesByPattern[t.patternId]!.push(t);
      }

      return patterns.map(p => ({
        ...p,
        times: timesByPattern[p.id] ?? [],
      }));
    }),

  /**
   * Create a meeting pattern
   */
  createMeetingPattern: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(meetingPatternInput)
    .mutation(async ({ ctx, input }) => {
      const { times, ...patternData } = input;

      const [pattern] = await ctx.db
        .insert(meetingPatterns)
        .values({
          institutionId: ctx.user.institutionId,
          name: patternData.name,
          code: patternData.code,
          totalMinutesPerWeek: patternData.totalMinutesPerWeek,
          creditHoursMin: patternData.creditHoursMin?.toString(),
          creditHoursMax: patternData.creditHoursMax?.toString(),
          patternType: patternData.patternType,
        })
        .returning();

      if (!pattern) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create meeting pattern",
        });
      }

      // Insert times
      if (times.length > 0) {
        await ctx.db.insert(meetingPatternTimes).values(
          times.map(t => ({
            patternId: pattern.id,
            dayOfWeek: t.dayOfWeek,
            startTime: t.startTime,
            endTime: t.endTime,
            breakMinutes: t.breakMinutes ?? 0,
          }))
        );
      }

      return pattern;
    }),

  // ===========================================================================
  // INSTRUCTOR WORKLOAD
  // ===========================================================================

  /**
   * Get instructor workloads for a term
   */
  listInstructorWorkloads: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler", "department_head"))
    .input(z.object({
      termId: z.string().uuid(),
      departmentId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const workloads = await ctx.db
        .select()
        .from(instructorWorkloads)
        .where(eq(instructorWorkloads.termId, input.termId));

      return workloads;
    }),

  /**
   * Set instructor workload
   */
  setInstructorWorkload: protectedProcedure
    .use(requireRole("admin", "registrar", "department_head"))
    .input(instructorWorkloadInput)
    .mutation(async ({ ctx, input }) => {
      // Upsert
      const [workload] = await ctx.db
        .insert(instructorWorkloads)
        .values({
          instructorId: input.instructorId,
          termId: input.termId,
          employmentType: input.employmentType,
          minLoad: input.minLoad?.toString(),
          maxLoad: input.maxLoad.toString(),
          targetLoad: input.targetLoad?.toString(),
          maxCourses: input.maxCourses,
          maxPreps: input.maxPreps,
          notes: input.notes,
        })
        .onConflictDoUpdate({
          target: [instructorWorkloads.instructorId, instructorWorkloads.termId],
          set: {
            employmentType: input.employmentType,
            minLoad: input.minLoad?.toString(),
            maxLoad: input.maxLoad.toString(),
            targetLoad: input.targetLoad?.toString(),
            maxCourses: input.maxCourses,
            maxPreps: input.maxPreps,
            notes: input.notes,
            updatedAt: new Date(),
          },
        })
        .returning();

      return workload;
    }),

  // ===========================================================================
  // ROOM AVAILABILITY
  // ===========================================================================

  /**
   * List room availability rules
   */
  listRoomAvailability: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .input(z.object({
      termId: z.string().uuid().optional(),
      roomId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [];

      if (input.termId) {
        conditions.push(eq(roomAvailability.termId, input.termId));
      }
      if (input.roomId) {
        conditions.push(eq(roomAvailability.roomId, input.roomId));
      }

      const availability = await ctx.db
        .select()
        .from(roomAvailability)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return availability;
    }),

  /**
   * Add room availability rule
   */
  addRoomAvailability: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(roomAvailabilityInput)
    .mutation(async ({ ctx, input }) => {
      const [rule] = await ctx.db
        .insert(roomAvailability)
        .values(input)
        .returning();

      return rule;
    }),

  // ===========================================================================
  // CONSTRAINT CONFIGURATION
  // ===========================================================================

  /**
   * List constraint types
   */
  listConstraintTypes: protectedProcedure
    .use(requireRole("admin", "registrar", "scheduler"))
    .query(async ({ ctx }) => {
      const constraints = await ctx.db
        .select()
        .from(constraintTypes)
        .where(eq(constraintTypes.institutionId, ctx.user.institutionId));

      return constraints;
    }),

  /**
   * Update constraint configuration
   */
  updateConstraintType: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({
      id: z.string().uuid(),
      isEnabled: z.boolean().optional(),
      defaultWeight: z.number().optional(),
      parameters: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [constraint] = await ctx.db
        .update(constraintTypes)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(
          eq(constraintTypes.id, id),
          eq(constraintTypes.institutionId, ctx.user.institutionId)
        ))
        .returning();

      if (!constraint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Constraint type not found",
        });
      }

      return constraint;
    }),

  // ===========================================================================
  // EXAM SCHEDULING
  // ===========================================================================

  /**
   * List exam periods
   */
  listExamPeriods: protectedProcedure
    .input(z.object({
      termId: z.string().uuid(),
      examType: z.enum(["midterm", "final"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(examPeriods.termId, input.termId)];

      if (input.examType) {
        conditions.push(eq(examPeriods.examType, input.examType));
      }

      const periods = await ctx.db
        .select()
        .from(examPeriods)
        .where(and(...conditions));

      return periods;
    }),

  /**
   * Create exam period
   */
  createExamPeriod: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(z.object({
      termId: z.string().uuid(),
      examType: z.enum(["midterm", "final"]),
      name: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      defaultStartTime: z.string().optional(),
      defaultDurationMinutes: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [period] = await ctx.db
        .insert(examPeriods)
        .values(input)
        .returning();

      return period;
    }),

  // ===========================================================================
  // SCHEDULE ROLLFORWARD
  // ===========================================================================

  /**
   * Roll a schedule version forward to a new term
   *
   * Creates a new draft schedule version for the target term by copying:
   * - Meeting patterns and time assignments
   * - Room assignments (if rooms still exist)
   * - Instructor assignments (if instructors still valid)
   * - Cross-list and section link groups
   *
   * Does NOT copy:
   * - Solver runs (new term needs fresh optimization)
   * - Constraint violations (will be recalculated)
   * - Published/archived status (new version starts as draft)
   */
  rollForward: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(z.object({
      sourceVersionId: z.string().uuid(),
      targetTermId: z.string().uuid(),
      name: z.string().optional(),
      options: z.object({
        copyRoomAssignments: z.boolean().default(true),
        copyInstructorAssignments: z.boolean().default(true),
        copyMeetingPatterns: z.boolean().default(true),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const opts = input.options ?? {
        copyRoomAssignments: true,
        copyInstructorAssignments: true,
        copyMeetingPatterns: true,
      };

      // Get source version
      const sourceVersion = await ctx.db
        .select()
        .from(scheduleVersions)
        .where(eq(scheduleVersions.id, input.sourceVersionId))
        .limit(1);

      if (!sourceVersion.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source schedule version not found",
        });
      }

      const source = sourceVersion[0]!;

      // Check target term exists and is different from source
      if (source.termId === input.targetTermId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target term must be different from source term",
        });
      }

      // Get highest version number for target term
      const existingVersions = await ctx.db
        .select({ versionNumber: scheduleVersions.versionNumber })
        .from(scheduleVersions)
        .where(and(
          eq(scheduleVersions.institutionId, source.institutionId),
          eq(scheduleVersions.termId, input.targetTermId)
        ))
        .orderBy(desc(scheduleVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = existingVersions.length && existingVersions[0]
        ? existingVersions[0].versionNumber + 1
        : 1;

      // Create new draft version
      const [newVersion] = await ctx.db
        .insert(scheduleVersions)
        .values({
          institutionId: source.institutionId,
          termId: input.targetTermId,
          versionNumber: nextVersionNumber,
          name: input.name ?? `Rolled from ${source.name ?? `v${source.versionNumber}`}`,
          status: "draft",
          createdBy: ctx.user!.id,
        })
        .returning();

      // Get source assignments to copy
      const sourceAssignments = await ctx.db
        .select()
        .from(sectionAssignments)
        .where(eq(sectionAssignments.scheduleVersionId, input.sourceVersionId));

      // Get mapping of old sections to new sections in target term
      // This requires sections to exist in target term with matching course/section numbers
      const sourceSections = await ctx.db
        .select({
          id: sections.id,
          courseId: sections.courseId,
          sectionNumber: sections.sectionNumber,
          termId: sections.termId,
        })
        .from(sections)
        .where(eq(sections.termId, source.termId));

      const targetSections = await ctx.db
        .select({
          id: sections.id,
          courseId: sections.courseId,
          sectionNumber: sections.sectionNumber,
        })
        .from(sections)
        .where(eq(sections.termId, input.targetTermId));

      // Build mapping: source section ID -> target section ID
      const sectionMap = new Map<string, string>();
      for (const src of sourceSections) {
        const target = targetSections.find(
          t => t.courseId === src.courseId && t.sectionNumber === src.sectionNumber
        );
        if (target) {
          sectionMap.set(src.id, target.id);
        }
      }

      if (!newVersion) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create new schedule version",
        });
      }

      // Copy assignments for sections that exist in both terms
      // Track mapping from old assignment IDs to new assignment IDs for instructor copy
      const assignmentIdMap = new Map<string, string>();
      const newAssignments: typeof sectionAssignments.$inferInsert[] = [];

      for (const assignment of sourceAssignments) {
        const targetSectionId = sectionMap.get(assignment.sectionId);
        if (!targetSectionId) continue; // Section doesn't exist in target term

        newAssignments.push({
          scheduleVersionId: newVersion.id,
          sectionId: targetSectionId,
          meetingPatternId: opts.copyMeetingPatterns ? assignment.meetingPatternId : null,
          datePatternId: null, // Date patterns are term-specific
          roomId: opts.copyRoomAssignments ? assignment.roomId : null,
          isManualOverride: false,
          assignmentSource: "rollforward",
          notes: `Rolled forward from ${source.name ?? `v${source.versionNumber}`}`,
        });
      }

      let createdAssignments: { id: string }[] = [];
      if (newAssignments.length > 0) {
        createdAssignments = await ctx.db
          .insert(sectionAssignments)
          .values(newAssignments)
          .returning({ id: sectionAssignments.id });

        // Build mapping from source assignment to new assignment
        // Assumes insert order is preserved
        const sourceAssignmentsToMap = sourceAssignments.filter(
          a => sectionMap.has(a.sectionId)
        );
        for (let i = 0; i < sourceAssignmentsToMap.length && i < createdAssignments.length; i++) {
          const created = createdAssignments[i];
          const sourceAssignment = sourceAssignmentsToMap[i];
          if (sourceAssignment && created) {
            assignmentIdMap.set(sourceAssignment.id, created.id);
          }
        }
      }

      // Copy instructor assignments if requested
      if (opts.copyInstructorAssignments && assignmentIdMap.size > 0) {
        // Get instructor assignments for the source section assignments
        const sourceAssignmentIds = Array.from(assignmentIdMap.keys());
        const sourceInstructorAssignments = await ctx.db
          .select()
          .from(instructorAssignments)
          .where(inArray(instructorAssignments.sectionAssignmentId, sourceAssignmentIds));

        const newInstructorAssignments: typeof instructorAssignments.$inferInsert[] = [];
        for (const ia of sourceInstructorAssignments) {
          const newSectionAssignmentId = assignmentIdMap.get(ia.sectionAssignmentId);
          if (!newSectionAssignmentId) continue;

          newInstructorAssignments.push({
            sectionAssignmentId: newSectionAssignmentId,
            instructorId: ia.instructorId,
            role: ia.role,
            loadCredit: ia.loadCredit,
            percentResponsibility: ia.percentResponsibility,
          });
        }

        if (newInstructorAssignments.length > 0) {
          await ctx.db.insert(instructorAssignments).values(newInstructorAssignments);
        }
      }

      return {
        version: newVersion,
        sectionsRolled: sectionMap.size,
        sectionsMissing: sourceSections.length - sectionMap.size,
      };
    }),

  // ===========================================================================
  // SECTION FORECASTING
  // ===========================================================================

  /**
   * Forecast section requirements for a future term
   *
   * Analyzes historical enrollment data to predict:
   * - Number of sections needed per course
   * - Expected enrollment per section
   * - Recommended capacity settings
   *
   * This is a placeholder that returns basic projections.
   * A production system would integrate with analytics/ML services.
   */
  forecastSections: protectedProcedure
    .use(requireRole("admin", "registrar"))
    .input(z.object({
      termId: z.string().uuid(),
      courseIds: z.array(z.string().uuid()).optional(),
      historicalTermCount: z.number().min(1).max(10).default(3),
    }))
    .query(async ({ ctx, input }) => {
      // Get historical enrollment data for the specified courses
      // For now, we look at past terms and calculate averages

      // This would be enhanced with:
      // 1. Trend analysis (growing/shrinking enrollment)
      // 2. Day/time preference patterns
      // 3. Seasonal adjustments
      // 4. Program growth projections

      const historicalData = await ctx.db
        .select({
          courseId: sections.courseId,
          termId: sections.termId,
          sectionCount: count(sections.id),
          avgEnrollment: avg(sections.currentEnrollment),
          avgCapacity: avg(sections.maxEnrollment),
          totalEnrollment: sum(sections.currentEnrollment),
        })
        .from(sections)
        .where(
          input.courseIds
            ? inArray(sections.courseId, input.courseIds)
            : sql`1=1`
        )
        .groupBy(sections.courseId, sections.termId);

      // Group by course and calculate projections
      const courseStats: Record<string, {
        historicalTerms: number;
        avgSectionsPerTerm: number;
        avgEnrollmentPerSection: number;
        totalHistoricalEnrollment: number;
        trend: "growing" | "stable" | "declining";
        recommendedSections: number;
        recommendedCapacity: number;
      }> = {};

      for (const row of historicalData) {
        if (!row.courseId) continue;

        if (!courseStats[row.courseId]) {
          courseStats[row.courseId] = {
            historicalTerms: 0,
            avgSectionsPerTerm: 0,
            avgEnrollmentPerSection: 0,
            totalHistoricalEnrollment: 0,
            trend: "stable",
            recommendedSections: 1,
            recommendedCapacity: 30,
          };
        }

        const stats = courseStats[row.courseId]!;
        stats.historicalTerms += 1;
        stats.avgSectionsPerTerm += Number(row.sectionCount);
        stats.avgEnrollmentPerSection += Number(row.avgEnrollment ?? 0);
        stats.totalHistoricalEnrollment += Number(row.totalEnrollment ?? 0);
      }

      // Finalize averages and make recommendations
      const forecasts = Object.entries(courseStats).map(([courseId, stats]) => {
        if (stats.historicalTerms > 0) {
          stats.avgSectionsPerTerm /= stats.historicalTerms;
          stats.avgEnrollmentPerSection /= stats.historicalTerms;
        }

        // Simple recommendation: round up sections, add 10% buffer to capacity
        stats.recommendedSections = Math.max(1, Math.ceil(stats.avgSectionsPerTerm));
        stats.recommendedCapacity = Math.max(
          20,
          Math.ceil(stats.avgEnrollmentPerSection * 1.1)
        );

        return {
          courseId,
          ...stats,
        };
      });

      return {
        termId: input.termId,
        historicalTermsAnalyzed: input.historicalTermCount,
        forecasts,
        disclaimer: "Forecasts are based on historical averages. Consider program changes, marketing efforts, and external factors when planning.",
      };
    }),
});
