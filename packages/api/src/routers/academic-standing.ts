/**
 * Academic Standing Router
 *
 * tRPC router for managing academic standing policies,
 * calculating student standing, and tracking standing history.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole, canAccessStudent } from "../trpc.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  academicStandingPolicies,
  academicStandingHistory,
  academicStandingAppeals,
  students,
  studentPrograms,
  studentGpaSummary,
} from "@sis/db";
import { terms } from "@sis/db";
import {
  calculateAcademicStanding,
  getStandingDisplayName,
  getStandingSeverity,
  getMinimumGpaForGoodStanding,
  calculateRequiredTermGpa,
  type AcademicStandingPolicy as DomainPolicy,
  type StandingHistoryEntry,
  type AcademicStandingStatus,
} from "@sis/domain";

// =============================================================================
// Schemas
// =============================================================================

const standingStatusSchema = z.enum([
  "good_standing",
  "academic_warning",
  "academic_probation",
  "academic_suspension",
  "academic_dismissal",
  "reinstated",
]);

const creditThresholdSchema = z.object({
  maxCredits: z.number().min(0),
  goodStandingMinGpa: z.number().min(0).max(4),
  probationMinGpa: z.number().min(0).max(4).optional(),
});

const policyInputSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(30),
  description: z.string().optional(),
  levelCode: z.string().max(20).optional(),
  goodStandingMinGpa: z.number().min(0).max(4).default(2.0),
  warningMinGpa: z.number().min(0).max(4).optional(),
  probationMinGpa: z.number().min(0).max(4).optional(),
  probationMaxTerms: z.number().min(1).max(10).default(2),
  suspensionDurationTerms: z.number().min(1).max(4).default(1),
  maxSuspensions: z.number().min(1).max(5).default(2),
  thresholdsByCredits: z.array(creditThresholdSchema).optional(),
  requiresMinimumCredits: z.boolean().default(false),
  minimumCreditsPerTerm: z.number().min(0).optional(),
  evaluateAfterEachTerm: z.boolean().default(true),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional(),
});

const appealStatusSchema = z.enum([
  "pending",
  "under_review",
  "approved",
  "denied",
  "withdrawn",
]);

// =============================================================================
// Router
// =============================================================================

export const academicStandingRouter = router({
  // ===========================================================================
  // Policy Management
  // ===========================================================================

  /**
   * Get all academic standing policies for the institution
   */
  getPolicies: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
        levelCode: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(academicStandingPolicies.institutionId, ctx.user.institutionId),
      ];

      if (input?.activeOnly !== false) {
        conditions.push(eq(academicStandingPolicies.isActive, true));
      }

      if (input?.levelCode) {
        conditions.push(eq(academicStandingPolicies.levelCode, input.levelCode));
      }

      const policies = await ctx.db.query.academicStandingPolicies.findMany({
        where: and(...conditions),
        orderBy: [academicStandingPolicies.name],
      });

      return policies;
    }),

  /**
   * Get a specific policy by ID
   */
  getPolicy: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({ policyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.query.academicStandingPolicies.findFirst({
        where: and(
          eq(academicStandingPolicies.id, input.policyId),
          eq(academicStandingPolicies.institutionId, ctx.user.institutionId)
        ),
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      return policy;
    }),

  /**
   * Create a new academic standing policy
   */
  createPolicy: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(policyInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate code
      const existing = await ctx.db.query.academicStandingPolicies.findFirst({
        where: and(
          eq(academicStandingPolicies.institutionId, ctx.user.institutionId),
          eq(academicStandingPolicies.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A policy with code "${input.code}" already exists`,
        });
      }

      const [policy] = await ctx.db
        .insert(academicStandingPolicies)
        .values({
          institutionId: ctx.user.institutionId,
          name: input.name,
          code: input.code,
          description: input.description,
          levelCode: input.levelCode,
          goodStandingMinGpa: input.goodStandingMinGpa.toFixed(3),
          warningMinGpa: input.warningMinGpa?.toFixed(3),
          probationMinGpa: input.probationMinGpa?.toFixed(3),
          probationMaxTerms: input.probationMaxTerms,
          suspensionDurationTerms: input.suspensionDurationTerms,
          maxSuspensions: input.maxSuspensions,
          thresholdsByCredits: input.thresholdsByCredits,
          requiresMinimumCredits: input.requiresMinimumCredits,
          minimumCreditsPerTerm: input.minimumCreditsPerTerm?.toFixed(2),
          evaluateAfterEachTerm: input.evaluateAfterEachTerm,
          isActive: input.isActive,
          effectiveFrom: input.effectiveFrom,
          effectiveUntil: input.effectiveUntil,
        })
        .returning();

      return policy;
    }),

  /**
   * Update an existing policy
   */
  updatePolicy: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        policyId: z.string().uuid(),
        updates: policyInputSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.academicStandingPolicies.findFirst({
        where: and(
          eq(academicStandingPolicies.id, input.policyId),
          eq(academicStandingPolicies.institutionId, ctx.user.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      // Check for duplicate code if code is being updated
      if (input.updates.code && input.updates.code !== existing.code) {
        const duplicate = await ctx.db.query.academicStandingPolicies.findFirst({
          where: and(
            eq(academicStandingPolicies.institutionId, ctx.user.institutionId),
            eq(academicStandingPolicies.code, input.updates.code)
          ),
        });

        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A policy with code "${input.updates.code}" already exists`,
          });
        }
      }

      const {
        goodStandingMinGpa,
        warningMinGpa,
        probationMinGpa,
        minimumCreditsPerTerm,
        ...otherUpdates
      } = input.updates;

      const updateData: Record<string, unknown> = {
        ...otherUpdates,
        updatedAt: new Date(),
      };

      // Convert numeric fields to strings for decimal columns
      if (goodStandingMinGpa !== undefined) {
        updateData["goodStandingMinGpa"] = goodStandingMinGpa.toFixed(3);
      }
      if (warningMinGpa !== undefined) {
        updateData["warningMinGpa"] = warningMinGpa.toFixed(3);
      }
      if (probationMinGpa !== undefined) {
        updateData["probationMinGpa"] = probationMinGpa.toFixed(3);
      }
      if (minimumCreditsPerTerm !== undefined) {
        updateData["minimumCreditsPerTerm"] = minimumCreditsPerTerm.toFixed(2);
      }

      const [policy] = await ctx.db
        .update(academicStandingPolicies)
        .set(updateData)
        .where(eq(academicStandingPolicies.id, input.policyId))
        .returning();

      return policy;
    }),

  // ===========================================================================
  // Standing Calculation
  // ===========================================================================

  /**
   * Calculate academic standing for a student
   */
  calculateStanding: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
        policyId: z.string().uuid().optional(), // If not provided, uses default for student level
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get student
      const student = await ctx.db.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.institutionId, ctx.user.institutionId)
        ),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Get student's primary program for level
      const studentProgram = await ctx.db.query.studentPrograms.findFirst({
        where: and(
          eq(studentPrograms.studentId, input.studentId),
          eq(studentPrograms.isPrimary, true)
        ),
      });

      // Get policy
      let policyId = input.policyId;
      if (!policyId) {
        // Find default policy (active, matching level or no level restriction)
        const defaultPolicy = await ctx.db.query.academicStandingPolicies.findFirst({
          where: and(
            eq(academicStandingPolicies.institutionId, ctx.user.institutionId),
            eq(academicStandingPolicies.isActive, true)
          ),
        });

        if (!defaultPolicy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active academic standing policy found",
          });
        }

        policyId = defaultPolicy.id;
      }

      const policy = await ctx.db.query.academicStandingPolicies.findFirst({
        where: eq(academicStandingPolicies.id, policyId),
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      // Get student's GPA summary
      const gpaSummary = await ctx.db.query.studentGpaSummary.findFirst({
        where: eq(studentGpaSummary.studentId, input.studentId),
      });

      if (!gpaSummary) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student GPA summary not found. Calculate GPA first.",
        });
      }

      // Get previous standing history
      const previousHistoryRaw = await ctx.db.query.academicStandingHistory.findMany({
        where: eq(academicStandingHistory.studentId, input.studentId),
        orderBy: [desc(academicStandingHistory.determinedAt)],
        limit: 10,
      });

      // Convert to domain type
      const previousHistory: StandingHistoryEntry[] = previousHistoryRaw
        .reverse()
        .map((h) => ({
          termId: h.termId,
          standing: h.standing as AcademicStandingStatus,
          termGpa: h.termGpa ? parseFloat(h.termGpa) : undefined,
          cumulativeGpa: h.cumulativeGpa ? parseFloat(h.cumulativeGpa) : undefined,
          termCreditsAttempted: h.termCreditsAttempted
            ? parseFloat(h.termCreditsAttempted)
            : undefined,
          termCreditsEarned: h.termCreditsEarned ? parseFloat(h.termCreditsEarned) : undefined,
          consecutiveProbationTerms: h.consecutiveProbationTerms ?? 0,
          totalProbationTerms: h.totalProbationTerms ?? 0,
          totalSuspensions: h.totalSuspensions ?? 0,
        }));

      // Get current standing
      const currentStanding = studentProgram?.academicStanding as
        | AcademicStandingStatus
        | undefined;

      // Convert policy to domain type
      const domainPolicy: DomainPolicy = {
        id: policy.id,
        code: policy.code,
        name: policy.name,
        levelCode: policy.levelCode ?? undefined,
        goodStandingMinGpa: parseFloat(policy.goodStandingMinGpa),
        warningMinGpa: policy.warningMinGpa ? parseFloat(policy.warningMinGpa) : undefined,
        probationMinGpa: policy.probationMinGpa ? parseFloat(policy.probationMinGpa) : undefined,
        probationMaxTerms: policy.probationMaxTerms ?? 2,
        suspensionDurationTerms: policy.suspensionDurationTerms ?? 1,
        maxSuspensions: policy.maxSuspensions ?? 2,
        thresholdsByCredits: policy.thresholdsByCredits as DomainPolicy["thresholdsByCredits"],
        requiresMinimumCredits: policy.requiresMinimumCredits ?? false,
        minimumCreditsPerTerm: policy.minimumCreditsPerTerm
          ? parseFloat(policy.minimumCreditsPerTerm)
          : undefined,
      };

      // Calculate standing
      const result = calculateAcademicStanding({
        termId: input.termId,
        cumulativeGpa: parseFloat(gpaSummary.cumulativeGpa ?? "0"),
        termGpa: parseFloat(gpaSummary.lastTermGpa ?? "0"),
        cumulativeCreditsAttempted: parseFloat(gpaSummary.cumulativeAttemptedCredits ?? "0"),
        cumulativeCreditsEarned: parseFloat(gpaSummary.cumulativeEarnedCredits ?? "0"),
        termCreditsAttempted: parseFloat(gpaSummary.lastTermAttemptedCredits ?? "0"),
        termCreditsEarned: parseFloat(gpaSummary.lastTermEarnedCredits ?? "0"),
        currentStanding,
        previousHistory,
        policy: domainPolicy,
      });

      // Save to history
      const insertResult = await ctx.db
        .insert(academicStandingHistory)
        .values({
          studentId: input.studentId,
          studentProgramId: studentProgram?.id,
          termId: input.termId,
          policyId: policy.id,
          standing: result.standing,
          previousStanding: result.previousStanding,
          termGpa: gpaSummary.lastTermGpa,
          cumulativeGpa: gpaSummary.cumulativeGpa,
          termCreditsAttempted: gpaSummary.lastTermAttemptedCredits,
          termCreditsEarned: gpaSummary.lastTermEarnedCredits,
          cumulativeCreditsAttempted: gpaSummary.cumulativeAttemptedCredits,
          cumulativeCreditsEarned: gpaSummary.cumulativeEarnedCredits,
          consecutiveProbationTerms: result.probationTracking.consecutiveTerms,
          totalProbationTerms: result.probationTracking.totalTerms,
          totalSuspensions: result.suspensionTracking.totalSuspensions,
          reason: result.reason,
          isAutomatic: true,
          determinedBy: ctx.user.id,
        })
        .returning();

      const historyEntry = insertResult[0];
      if (!historyEntry) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create standing history entry",
        });
      }

      // Update student program standing if changed
      if (result.standingChanged && studentProgram) {
        await ctx.db
          .update(studentPrograms)
          .set({
            academicStanding: result.standing,
            updatedAt: new Date(),
          })
          .where(eq(studentPrograms.id, studentProgram.id));
      }

      return {
        historyId: historyEntry.id,
        result: {
          ...result,
          standingDisplayName: getStandingDisplayName(result.standing),
          severity: getStandingSeverity(result.standing),
        },
      };
    }),

  /**
   * Batch calculate standing for multiple students
   */
  batchCalculateStanding: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        termId: z.string().uuid(),
        policyId: z.string().uuid().optional(),
        studentIds: z.array(z.string().uuid()).optional(), // If not provided, process all enrolled
        dryRun: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get policy
      let policyId = input.policyId;
      if (!policyId) {
        const defaultPolicy = await ctx.db.query.academicStandingPolicies.findFirst({
          where: and(
            eq(academicStandingPolicies.institutionId, ctx.user.institutionId),
            eq(academicStandingPolicies.isActive, true)
          ),
        });

        if (!defaultPolicy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active academic standing policy found",
          });
        }

        policyId = defaultPolicy.id;
      }

      // For now, just return a summary - actual batch processing would be a background job
      // This is a placeholder for the batch calculation logic
      return {
        message: "Batch calculation would be processed asynchronously",
        termId: input.termId,
        policyId,
        dryRun: input.dryRun,
        studentCount: input.studentIds?.length ?? "all enrolled",
      };
    }),

  // ===========================================================================
  // Standing History
  // ===========================================================================

  /**
   * Get standing history for a student
   */
  getStudentHistory: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.query.academicStandingHistory.findMany({
        where: eq(academicStandingHistory.studentId, input.studentId),
        orderBy: [desc(academicStandingHistory.determinedAt)],
        limit: input.limit,
        with: {
          policy: true,
        },
      });

      // Get term info separately
      const termIds = [...new Set(history.map((h) => h.termId))];
      const termsData =
        termIds.length > 0
          ? await ctx.db.query.terms.findMany({
              where: inArray(terms.id, termIds),
            })
          : [];

      const termsMap = new Map(termsData.map((t) => [t.id, t]));

      return history.map((h) => ({
        ...h,
        term: termsMap.get(h.termId),
        standingDisplayName: getStandingDisplayName(h.standing as AcademicStandingStatus),
        severity: getStandingSeverity(h.standing as AcademicStandingStatus),
      }));
    }),

  /**
   * Get current standing for a student
   */
  getCurrentStanding: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Get from student program
      const studentProgram = await ctx.db.query.studentPrograms.findFirst({
        where: and(
          eq(studentPrograms.studentId, input.studentId),
          eq(studentPrograms.isPrimary, true)
        ),
      });

      // Get most recent history entry
      const latestHistory = await ctx.db.query.academicStandingHistory.findFirst({
        where: eq(academicStandingHistory.studentId, input.studentId),
        orderBy: [desc(academicStandingHistory.determinedAt)],
        with: {
          policy: true,
        },
      });

      const standing = (studentProgram?.academicStanding ??
        latestHistory?.standing ??
        "good_standing") as AcademicStandingStatus;

      return {
        standing,
        standingDisplayName: getStandingDisplayName(standing),
        severity: getStandingSeverity(standing),
        latestHistory,
        studentProgramId: studentProgram?.id,
      };
    }),

  /**
   * Manually update student standing (with reason)
   */
  updateStanding: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
        standing: standingStatusSchema,
        reason: z.string().min(1),
        internalNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get student
      const student = await ctx.db.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.institutionId, ctx.user.institutionId)
        ),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Get student program
      const studentProgram = await ctx.db.query.studentPrograms.findFirst({
        where: and(
          eq(studentPrograms.studentId, input.studentId),
          eq(studentPrograms.isPrimary, true)
        ),
      });

      // Get previous standing
      const previousHistory = await ctx.db.query.academicStandingHistory.findFirst({
        where: eq(academicStandingHistory.studentId, input.studentId),
        orderBy: [desc(academicStandingHistory.determinedAt)],
      });

      // Get current GPA summary
      const gpaSummary = await ctx.db.query.studentGpaSummary.findFirst({
        where: eq(studentGpaSummary.studentId, input.studentId),
      });

      // Create history entry
      const [historyEntry] = await ctx.db
        .insert(academicStandingHistory)
        .values({
          studentId: input.studentId,
          studentProgramId: studentProgram?.id,
          termId: input.termId,
          standing: input.standing,
          previousStanding: previousHistory?.standing,
          termGpa: gpaSummary?.lastTermGpa,
          cumulativeGpa: gpaSummary?.cumulativeGpa,
          termCreditsAttempted: gpaSummary?.lastTermAttemptedCredits,
          termCreditsEarned: gpaSummary?.lastTermEarnedCredits,
          cumulativeCreditsAttempted: gpaSummary?.cumulativeAttemptedCredits,
          cumulativeCreditsEarned: gpaSummary?.cumulativeEarnedCredits,
          consecutiveProbationTerms: previousHistory?.consecutiveProbationTerms ?? 0,
          totalProbationTerms: previousHistory?.totalProbationTerms ?? 0,
          totalSuspensions: previousHistory?.totalSuspensions ?? 0,
          reason: input.reason,
          internalNotes: input.internalNotes,
          isAutomatic: false,
          determinedBy: ctx.user.id,
        })
        .returning();

      // Update student program
      if (studentProgram) {
        await ctx.db
          .update(studentPrograms)
          .set({
            academicStanding: input.standing,
            updatedAt: new Date(),
          })
          .where(eq(studentPrograms.id, studentProgram.id));
      }

      return historyEntry;
    }),

  // ===========================================================================
  // Appeals
  // ===========================================================================

  /**
   * Get appeals for review
   */
  getAppeals: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        status: z.preprocess(
          (val) => (val === "" ? undefined : val),
          appealStatusSchema.optional()
        ),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions: Array<ReturnType<typeof eq>> = [];

      if (input?.status) {
        conditions.push(eq(academicStandingAppeals.status, input.status));
      }

      // Get all appeals with student info
      const appeals = await ctx.db.query.academicStandingAppeals.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(academicStandingAppeals.appealDate)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        with: {
          student: true,
          standingHistory: true,
        },
      });

      // Filter by institution (through student)
      const filteredAppeals = appeals.filter(
        (a) => a.student.institutionId === ctx.user.institutionId
      );

      return filteredAppeals;
    }),

  /**
   * Submit an appeal
   */
  submitAppeal: protectedProcedure
    .input(
      z.object({
        standingHistoryId: z.string().uuid(),
        appealReason: z.string().min(10),
        academicPlanDetails: z.string().optional(),
        academicPlanSubmitted: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the standing history entry
      const historyEntry = await ctx.db.query.academicStandingHistory.findFirst({
        where: eq(academicStandingHistory.id, input.standingHistoryId),
        with: {
          student: true,
        },
      });

      if (!historyEntry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Standing history entry not found",
        });
      }

      // Verify student access
      const isStudent = ctx.user.studentId === historyEntry.studentId;
      const isStaff = ctx.user.roles.some((r) => ["ADMIN", "REGISTRAR", "ADVISOR"].includes(r));

      if (!isStudent && !isStaff) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to submit this appeal",
        });
      }

      // Check for existing pending appeal
      const existingAppeal = await ctx.db.query.academicStandingAppeals.findFirst({
        where: and(
          eq(academicStandingAppeals.standingHistoryId, input.standingHistoryId),
          eq(academicStandingAppeals.status, "pending")
        ),
      });

      if (existingAppeal) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An appeal is already pending for this standing decision",
        });
      }

      // Create appeal
      const [appeal] = await ctx.db
        .insert(academicStandingAppeals)
        .values({
          standingHistoryId: input.standingHistoryId,
          studentId: historyEntry.studentId,
          appealDate: new Date().toISOString().split("T")[0]!,
          appealReason: input.appealReason,
          academicPlanSubmitted: input.academicPlanSubmitted,
          academicPlanDetails: input.academicPlanDetails,
          status: "pending",
        })
        .returning();

      return appeal;
    }),

  /**
   * Review an appeal
   */
  reviewAppeal: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        appealId: z.string().uuid(),
        status: z.enum(["approved", "denied"]),
        reviewNotes: z.string().min(1),
        resultingStanding: standingStatusSchema.optional(),
        approvalConditions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const appeal = await ctx.db.query.academicStandingAppeals.findFirst({
        where: eq(academicStandingAppeals.id, input.appealId),
        with: {
          standingHistory: true,
          student: true,
        },
      });

      if (!appeal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appeal not found",
        });
      }

      if (appeal.student.institutionId !== ctx.user.institutionId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to review this appeal",
        });
      }

      // Update appeal
      const [updatedAppeal] = await ctx.db
        .update(academicStandingAppeals)
        .set({
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes,
          resultingStanding: input.resultingStanding,
          approvalConditions: input.approvalConditions,
          updatedAt: new Date(),
        })
        .where(eq(academicStandingAppeals.id, input.appealId))
        .returning();

      // If approved with a new standing, update the student
      if (input.status === "approved" && input.resultingStanding) {
        // Update student program
        const studentProgram = await ctx.db.query.studentPrograms.findFirst({
          where: and(
            eq(studentPrograms.studentId, appeal.studentId),
            eq(studentPrograms.isPrimary, true)
          ),
        });

        if (studentProgram) {
          await ctx.db
            .update(studentPrograms)
            .set({
              academicStanding: input.resultingStanding,
              updatedAt: new Date(),
            })
            .where(eq(studentPrograms.id, studentProgram.id));
        }

        // Create new history entry for the reinstatement
        await ctx.db.insert(academicStandingHistory).values({
          studentId: appeal.studentId,
          studentProgramId: studentProgram?.id,
          termId: appeal.standingHistory.termId,
          policyId: appeal.standingHistory.policyId,
          standing: input.resultingStanding,
          previousStanding: appeal.standingHistory.standing,
          cumulativeGpa: appeal.standingHistory.cumulativeGpa,
          reason: `Appeal approved. ${input.reviewNotes}`,
          internalNotes: input.approvalConditions,
          isAutomatic: false,
          determinedBy: ctx.user.id,
        });
      }

      return updatedAppeal;
    }),

  // ===========================================================================
  // Dashboard / Reports
  // ===========================================================================

  /**
   * Get standing statistics for dashboard
   */
  getStandingStats: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        termId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Get counts by standing
      const conditions = [];

      if (input?.termId) {
        conditions.push(eq(academicStandingHistory.termId, input.termId));
      }

      // This is a simplified version - in production you'd use raw SQL for efficiency
      const allHistory = await ctx.db.query.academicStandingHistory.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          student: true,
        },
      });

      // Filter by institution
      const filteredHistory = allHistory.filter(
        (h) => h.student.institutionId === ctx.user.institutionId
      );

      // Count by standing
      const standingCounts: Record<string, number> = {};
      for (const entry of filteredHistory) {
        standingCounts[entry.standing] = (standingCounts[entry.standing] || 0) + 1;
      }

      // Count changes from previous
      const changesCount = filteredHistory.filter(
        (h) => h.previousStanding && h.previousStanding !== h.standing
      ).length;

      // Pending appeals count
      const pendingAppeals = await ctx.db.query.academicStandingAppeals.findMany({
        where: eq(academicStandingAppeals.status, "pending"),
        with: {
          student: true,
        },
      });

      const institutionAppeals = pendingAppeals.filter(
        (a) => a.student.institutionId === ctx.user.institutionId
      );

      return {
        standingCounts,
        totalEvaluated: filteredHistory.length,
        standingChanges: changesCount,
        pendingAppeals: institutionAppeals.length,
      };
    }),

  /**
   * Get students at risk (on probation approaching suspension)
   */
  getAtRiskStudents: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // Get students on probation with high consecutive terms
      const history = await ctx.db.query.academicStandingHistory.findMany({
        where: eq(academicStandingHistory.standing, "academic_probation"),
        orderBy: [desc(academicStandingHistory.consecutiveProbationTerms)],
        with: {
          student: true,
          policy: true,
        },
      });

      // Filter by institution and get unique students
      const seen = new Set<string>();
      const atRiskStudents = history
        .filter((h) => h.student.institutionId === ctx.user.institutionId)
        .filter((h) => {
          if (seen.has(h.studentId)) return false;
          seen.add(h.studentId);
          return true;
        })
        .slice(0, input?.limit ?? 50)
        .map((h) => ({
          studentId: h.studentId,
          studentName: `${h.student.legalFirstName} ${h.student.legalLastName}`,
          studentIdNumber: h.student.studentId,
          consecutiveProbationTerms: h.consecutiveProbationTerms,
          totalProbationTerms: h.totalProbationTerms,
          maxTermsAllowed: h.policy?.probationMaxTerms ?? 2,
          termsRemaining: Math.max(
            0,
            (h.policy?.probationMaxTerms ?? 2) - (h.consecutiveProbationTerms ?? 0)
          ),
          cumulativeGpa: h.cumulativeGpa,
        }));

      return atRiskStudents;
    }),

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Get terms for dropdown
   */
  getTerms: protectedProcedure.query(async ({ ctx }) => {
    const allTerms = await ctx.db.query.terms.findMany({
      orderBy: [desc(terms.startDate)],
      limit: 20,
    });

    // Filter by institution
    return allTerms.filter((t) => t.institutionId === ctx.user.institutionId);
  }),

  /**
   * Search students for standing lookup
   */
  searchStudents: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Search by student ID, name, or email
      const searchResults = await ctx.db.query.students.findMany({
        where: and(
          eq(students.institutionId, ctx.user.institutionId),
          sql`(
            ${students.studentId} ILIKE ${"%" + input.query + "%"} OR
            ${students.legalFirstName} ILIKE ${"%" + input.query + "%"} OR
            ${students.legalLastName} ILIKE ${"%" + input.query + "%"} OR
            ${students.primaryEmail} ILIKE ${"%" + input.query + "%"}
          )`
        ),
        limit: input.limit,
      });

      return searchResults.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        name: `${s.legalFirstName} ${s.legalLastName}`,
        email: s.primaryEmail,
      }));
    }),
});
