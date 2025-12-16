/**
 * Transfer Credit Router
 *
 * Handles transfer credit evaluation operations including:
 * - Listing transfer credits with filtering
 * - Creating new transfer credit records
 * - Evaluating pending transfer credits
 * - Updating equivalencies
 *
 * All operations enforce FERPA compliance through canAccessStudent middleware.
 */

import { z } from "zod";
import { eq, and, desc, ilike, or, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  canAccessStudent,
  requireRole,
} from "../trpc.js";
import {
  transferCredits,
  students,
  courses,
  users,
} from "@sis/db/schema";

// ============================================================================
// Input Schemas
// ============================================================================

const transferCreditStatusSchema = z.enum(["pending", "approved", "denied"]);

const listTransferCreditsSchema = z.object({
  status: transferCreditStatusSchema.optional(),
  studentId: z.string().uuid().optional(),
  search: z.string().optional(), // Search by institution name or course
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const createTransferCreditSchema = z.object({
  studentId: z.string().uuid(),
  sourceInstitutionName: z.string().min(1).max(200),
  sourceInstitutionCode: z.string().max(20).optional(),
  sourceInstitutionType: z.enum(["4year", "2year", "international"]).optional(),
  sourceCourseCode: z.string().max(30).optional(),
  sourceCourseTitle: z.string().max(200).optional(),
  sourceCredits: z.number().positive(),
  sourceGrade: z.string().max(10).optional(),
  equivalentCourseId: z.string().uuid().optional(),
  transferCredits: z.number().positive(),
  includeInGpa: z.boolean().default(false),
  transcriptReceivedDate: z.string().date().optional(),
  status: transferCreditStatusSchema.default("pending"),
  evaluationNotes: z.string().optional(),
});

const evaluateTransferCreditSchema = z.object({
  transferCreditId: z.string().uuid(),
  status: transferCreditStatusSchema,
  equivalentCourseId: z.string().uuid().optional().nullable(),
  transferCredits: z.number().positive().optional(),
  includeInGpa: z.boolean().optional(),
  evaluationNotes: z.string().optional(),
});

const updateTransferCreditSchema = z.object({
  transferCreditId: z.string().uuid(),
  sourceInstitutionName: z.string().min(1).max(200).optional(),
  sourceInstitutionCode: z.string().max(20).optional().nullable(),
  sourceInstitutionType: z.enum(["4year", "2year", "international"]).optional().nullable(),
  sourceCourseCode: z.string().max(30).optional().nullable(),
  sourceCourseTitle: z.string().max(200).optional().nullable(),
  sourceCredits: z.number().positive().optional(),
  sourceGrade: z.string().max(10).optional().nullable(),
  equivalentCourseId: z.string().uuid().optional().nullable(),
  transferCredits: z.number().positive().optional(),
  includeInGpa: z.boolean().optional(),
  transcriptReceivedDate: z.string().date().optional().nullable(),
  evaluationNotes: z.string().optional().nullable(),
});

// ============================================================================
// Router
// ============================================================================

export const transferCreditRouter = router({
  /**
   * List transfer credits with optional filtering
   * Accessible by registrar and admin roles
   */
  list: protectedProcedure
    .input(listTransferCreditsSchema)
    .use(requireRole(["admin", "registrar"]))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(transferCredits.status, input.status));
      }

      if (input.studentId) {
        conditions.push(eq(transferCredits.studentId, input.studentId));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(transferCredits.sourceInstitutionName, `%${input.search}%`),
            ilike(transferCredits.sourceCourseTitle, `%${input.search}%`),
            ilike(transferCredits.sourceCourseCode, `%${input.search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await ctx.db.query.transferCredits.findMany({
        where: whereClause,
        with: {
          student: true,
          equivalentCourse: true,
          evaluatedByUser: true,
        },
        orderBy: [desc(transferCredits.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      // Get total count for pagination
      const countResult = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(transferCredits)
        .where(whereClause);

      return {
        items: results,
        total: Number(countResult[0]?.count ?? 0),
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Get a single transfer credit by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole(["admin", "registrar"]))
    .query(async ({ ctx, input }) => {
      const credit = await ctx.db.query.transferCredits.findFirst({
        where: eq(transferCredits.id, input.id),
        with: {
          student: true,
          equivalentCourse: true,
          evaluatedByUser: true,
        },
      });

      if (!credit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transfer credit not found",
        });
      }

      return credit;
    }),

  /**
   * Get transfer credits for a specific student
   * Enforces FERPA through canAccessStudent
   */
  getForStudent: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => input.studentId))
    .query(async ({ ctx, input }) => {
      const credits = await ctx.db.query.transferCredits.findMany({
        where: eq(transferCredits.studentId, input.studentId),
        with: {
          equivalentCourse: true,
          evaluatedByUser: true,
        },
        orderBy: [desc(transferCredits.createdAt)],
      });

      return credits;
    }),

  /**
   * Create a new transfer credit record
   */
  create: protectedProcedure
    .input(createTransferCreditSchema)
    .use(requireRole(["admin", "registrar"]))
    .mutation(async ({ ctx, input }) => {
      // Verify student exists
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Verify equivalent course exists if provided
      if (input.equivalentCourseId) {
        const course = await ctx.db.query.courses.findFirst({
          where: eq(courses.id, input.equivalentCourseId),
        });

        if (!course) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equivalent course not found",
          });
        }
      }

      const [credit] = await ctx.db
        .insert(transferCredits)
        .values({
          studentId: input.studentId,
          sourceInstitutionName: input.sourceInstitutionName,
          sourceInstitutionCode: input.sourceInstitutionCode,
          sourceInstitutionType: input.sourceInstitutionType,
          sourceCourseCode: input.sourceCourseCode,
          sourceCourseTitle: input.sourceCourseTitle,
          sourceCredits: input.sourceCredits.toString(),
          sourceGrade: input.sourceGrade,
          equivalentCourseId: input.equivalentCourseId,
          transferCredits: input.transferCredits.toString(),
          status: input.status,
          includeInGpa: input.includeInGpa,
          transcriptReceivedDate: input.transcriptReceivedDate,
          evaluationNotes: input.evaluationNotes,
          // If already approved, set evaluator info
          ...(input.status === "approved" || input.status === "denied"
            ? {
                evaluatedBy: ctx.session.user.id,
                evaluatedAt: new Date(),
              }
            : {}),
        })
        .returning();

      return credit;
    }),

  /**
   * Evaluate a pending transfer credit
   */
  evaluate: protectedProcedure
    .input(evaluateTransferCreditSchema)
    .use(requireRole(["admin", "registrar"]))
    .mutation(async ({ ctx, input }) => {
      // Verify transfer credit exists
      const existing = await ctx.db.query.transferCredits.findFirst({
        where: eq(transferCredits.id, input.transferCreditId),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transfer credit not found",
        });
      }

      // Verify equivalent course exists if provided
      if (input.equivalentCourseId) {
        const course = await ctx.db.query.courses.findFirst({
          where: eq(courses.id, input.equivalentCourseId),
        });

        if (!course) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equivalent course not found",
          });
        }
      }

      const [updated] = await ctx.db
        .update(transferCredits)
        .set({
          status: input.status,
          equivalentCourseId: input.equivalentCourseId ?? null,
          transferCredits: input.transferCredits?.toString() ?? existing.transferCredits,
          includeInGpa: input.includeInGpa ?? existing.includeInGpa,
          evaluationNotes: input.evaluationNotes,
          evaluatedBy: ctx.session.user.id,
          evaluatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transferCredits.id, input.transferCreditId))
        .returning();

      return updated;
    }),

  /**
   * Update a transfer credit record
   */
  update: protectedProcedure
    .input(updateTransferCreditSchema)
    .use(requireRole(["admin", "registrar"]))
    .mutation(async ({ ctx, input }) => {
      const { transferCreditId, ...updateData } = input;

      // Verify transfer credit exists
      const existing = await ctx.db.query.transferCredits.findFirst({
        where: eq(transferCredits.id, transferCreditId),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transfer credit not found",
        });
      }

      // Verify equivalent course exists if provided
      if (updateData.equivalentCourseId) {
        const course = await ctx.db.query.courses.findFirst({
          where: eq(courses.id, updateData.equivalentCourseId),
        });

        if (!course) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Equivalent course not found",
          });
        }
      }

      // Build update object, converting numbers to strings for decimal fields
      const updateObj: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (updateData.sourceInstitutionName !== undefined) {
        updateObj.sourceInstitutionName = updateData.sourceInstitutionName;
      }
      if (updateData.sourceInstitutionCode !== undefined) {
        updateObj.sourceInstitutionCode = updateData.sourceInstitutionCode;
      }
      if (updateData.sourceInstitutionType !== undefined) {
        updateObj.sourceInstitutionType = updateData.sourceInstitutionType;
      }
      if (updateData.sourceCourseCode !== undefined) {
        updateObj.sourceCourseCode = updateData.sourceCourseCode;
      }
      if (updateData.sourceCourseTitle !== undefined) {
        updateObj.sourceCourseTitle = updateData.sourceCourseTitle;
      }
      if (updateData.sourceCredits !== undefined) {
        updateObj.sourceCredits = updateData.sourceCredits.toString();
      }
      if (updateData.sourceGrade !== undefined) {
        updateObj.sourceGrade = updateData.sourceGrade;
      }
      if (updateData.equivalentCourseId !== undefined) {
        updateObj.equivalentCourseId = updateData.equivalentCourseId;
      }
      if (updateData.transferCredits !== undefined) {
        updateObj.transferCredits = updateData.transferCredits.toString();
      }
      if (updateData.includeInGpa !== undefined) {
        updateObj.includeInGpa = updateData.includeInGpa;
      }
      if (updateData.transcriptReceivedDate !== undefined) {
        updateObj.transcriptReceivedDate = updateData.transcriptReceivedDate;
      }
      if (updateData.evaluationNotes !== undefined) {
        updateObj.evaluationNotes = updateData.evaluationNotes;
      }

      const [updated] = await ctx.db
        .update(transferCredits)
        .set(updateObj)
        .where(eq(transferCredits.id, transferCreditId))
        .returning();

      return updated;
    }),

  /**
   * Delete a transfer credit record
   * Only allowed for pending credits
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole(["admin", "registrar"]))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.transferCredits.findFirst({
        where: eq(transferCredits.id, input.id),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transfer credit not found",
        });
      }

      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only pending transfer credits can be deleted",
        });
      }

      await ctx.db
        .delete(transferCredits)
        .where(eq(transferCredits.id, input.id));

      return { success: true };
    }),

  /**
   * Get available courses for equivalency matching
   */
  getAvailableCourses: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .use(requireRole(["admin", "registrar"]))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            ilike(courses.courseCode, `%${input.search}%`),
            ilike(courses.title, `%${input.search}%`)
          )
        );
      }

      const results = await ctx.db.query.courses.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        limit: input.limit,
        orderBy: [courses.courseCode],
      });

      return results;
    }),

  /**
   * Get summary statistics for transfer credits
   */
  getStats: protectedProcedure
    .use(requireRole(["admin", "registrar"]))
    .query(async ({ ctx }) => {
      const stats = await ctx.db
        .select({
          status: transferCredits.status,
          count: sql<number>`count(*)`,
          totalCredits: sql<number>`sum(${transferCredits.transferCredits}::numeric)`,
        })
        .from(transferCredits)
        .groupBy(transferCredits.status);

      return {
        pending: stats.find((s) => s.status === "pending") ?? { count: 0, totalCredits: 0 },
        approved: stats.find((s) => s.status === "approved") ?? { count: 0, totalCredits: 0 },
        denied: stats.find((s) => s.status === "denied") ?? { count: 0, totalCredits: 0 },
      };
    }),
});
