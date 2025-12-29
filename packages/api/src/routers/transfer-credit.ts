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
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
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
  externalInstitutions,
  articulationAgreements,
  courseEquivalencyRules,
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
                evaluatedBy: ctx.user!.id,
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
          evaluatedBy: ctx.user!.id,
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
      const updateObj: {
        updatedAt: Date;
        sourceInstitutionName?: string;
        sourceInstitutionCode?: string | null;
        sourceInstitutionType?: string | null;
        sourceCourseCode?: string | null;
        sourceCourseTitle?: string | null;
        sourceCredits?: string;
        sourceGrade?: string | null;
        equivalentCourseId?: string | null;
        transferCredits?: string;
        includeInGpa?: boolean;
        transcriptReceivedDate?: string | null;
        evaluationNotes?: string | null;
      } = {
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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
    .use(requireRole("ADMIN", "REGISTRAR"))
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

  // ============================================================================
  // External Institutions
  // ============================================================================

  /**
   * List external institutions
   */
  listExternalInstitutions: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        institutionType: z.string().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            ilike(externalInstitutions.name, `%${input.search}%`),
            ilike(externalInstitutions.ficeCode, `%${input.search}%`),
            ilike(externalInstitutions.ceebCode, `%${input.search}%`),
            ilike(externalInstitutions.city, `%${input.search}%`)
          )
        );
      }

      if (input.institutionType) {
        conditions.push(eq(externalInstitutions.institutionType, input.institutionType));
      }

      if (input.isActive !== undefined) {
        conditions.push(eq(externalInstitutions.isActive, input.isActive));
      }

      const institutions = await ctx.db.query.externalInstitutions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [externalInstitutions.name],
        limit: input.limit,
        offset: input.offset,
      });

      const total = await ctx.db.query.externalInstitutions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        columns: { id: true },
      });

      return {
        institutions,
        total: total.length,
        hasMore: input.offset + input.limit < total.length,
      };
    }),

  /**
   * Create external institution
   */
  createExternalInstitution: protectedProcedure
    .input(
      z.object({
        ficeCode: z.string().max(10).optional(),
        opeId: z.string().max(10).optional(),
        ceebCode: z.string().max(10).optional(),
        ipedsId: z.string().max(10).optional(),
        name: z.string().min(1).max(200),
        shortName: z.string().max(50).optional(),
        city: z.string().max(100).optional(),
        stateProvince: z.string().max(50).optional(),
        country: z.string().length(2).default("US"),
        institutionType: z.enum(["4year_public", "4year_private", "2year", "technical", "international"]),
        accreditingBody: z.string().max(100).optional(),
        isRegionallyAccredited: z.boolean().default(true),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const [institution] = await ctx.db
        .insert(externalInstitutions)
        .values({
          institutionId: ctx.user.institutionId,
          ...input,
        })
        .returning();

      return { institution };
    }),

  /**
   * Update external institution
   */
  updateExternalInstitution: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ficeCode: z.string().max(10).optional().nullable(),
        opeId: z.string().max(10).optional().nullable(),
        ceebCode: z.string().max(10).optional().nullable(),
        ipedsId: z.string().max(10).optional().nullable(),
        name: z.string().min(1).max(200).optional(),
        shortName: z.string().max(50).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        stateProvince: z.string().max(50).optional().nullable(),
        country: z.string().length(2).optional(),
        institutionType: z.enum(["4year_public", "4year_private", "2year", "technical", "international"]).optional(),
        accreditingBody: z.string().max(100).optional().nullable(),
        isRegionallyAccredited: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await ctx.db
        .update(externalInstitutions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(externalInstitutions.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "External institution not found",
        });
      }

      return { institution: updated };
    }),

  // ============================================================================
  // Articulation Agreements
  // ============================================================================

  /**
   * List articulation agreements
   */
  listAgreements: protectedProcedure
    .input(
      z.object({
        externalInstitutionId: z.string().uuid().optional(),
        status: z.enum(["draft", "active", "expired", "terminated"]).optional(),
        agreementType: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.externalInstitutionId) {
        conditions.push(eq(articulationAgreements.externalInstitutionId, input.externalInstitutionId));
      }

      if (input.status) {
        conditions.push(eq(articulationAgreements.status, input.status));
      }

      if (input.agreementType) {
        conditions.push(eq(articulationAgreements.agreementType, input.agreementType));
      }

      const agreements = await ctx.db.query.articulationAgreements.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          externalInstitution: true,
          approver: true,
        },
        orderBy: [desc(articulationAgreements.effectiveFrom)],
        limit: input.limit,
        offset: input.offset,
      });

      return {
        agreements: agreements.map((a) => ({
          ...a,
          externalInstitutionName: a.externalInstitution?.name ?? null,
          approverName: a.approver?.displayName ?? null,
        })),
      };
    }),

  /**
   * Create articulation agreement
   */
  createAgreement: protectedProcedure
    .input(
      z.object({
        externalInstitutionId: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        agreementType: z.enum(["general", "program_specific", "course_specific", "consortium"]),
        programId: z.string().uuid().optional(),
        effectiveFrom: z.string().date(),
        effectiveTo: z.string().date().optional(),
        documentUrl: z.string().url().optional(),
        autoApply: z.boolean().default(true),
        status: z.enum(["draft", "active"]).default("draft"),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const [agreement] = await ctx.db
        .insert(articulationAgreements)
        .values({
          institutionId: ctx.user.institutionId,
          ...input,
        })
        .returning();

      return { agreement };
    }),

  /**
   * Update articulation agreement
   */
  updateAgreement: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional().nullable(),
        agreementType: z.enum(["general", "program_specific", "course_specific", "consortium"]).optional(),
        effectiveFrom: z.string().date().optional(),
        effectiveTo: z.string().date().optional().nullable(),
        documentUrl: z.string().url().optional().nullable(),
        autoApply: z.boolean().optional(),
        status: z.enum(["draft", "active", "expired", "terminated"]).optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await ctx.db
        .update(articulationAgreements)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(articulationAgreements.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agreement not found",
        });
      }

      return { agreement: updated };
    }),

  /**
   * Approve an articulation agreement
   */
  approveAgreement: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      const [updated] = await ctx.db
        .update(articulationAgreements)
        .set({
          status: "active",
          approvedBy: ctx.user.id,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(articulationAgreements.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agreement not found",
        });
      }

      return { agreement: updated };
    }),

  // ============================================================================
  // Course Equivalency Rules
  // ============================================================================

  /**
   * List course equivalency rules
   */
  listEquivalencyRules: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid().optional(),
        externalInstitutionId: z.string().uuid().optional(),
        externalCourseCode: z.string().optional(),
        equivalentCourseId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.agreementId) {
        conditions.push(eq(courseEquivalencyRules.agreementId, input.agreementId));
      }

      if (input.externalInstitutionId) {
        conditions.push(eq(courseEquivalencyRules.externalInstitutionId, input.externalInstitutionId));
      }

      if (input.externalCourseCode) {
        conditions.push(ilike(courseEquivalencyRules.externalCourseCode, `%${input.externalCourseCode}%`));
      }

      if (input.equivalentCourseId) {
        conditions.push(eq(courseEquivalencyRules.equivalentCourseId, input.equivalentCourseId));
      }

      if (input.isActive !== undefined) {
        conditions.push(eq(courseEquivalencyRules.isActive, input.isActive));
      }

      const rules = await ctx.db.query.courseEquivalencyRules.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          agreement: true,
          externalInstitution: true,
          equivalentCourse: true,
        },
        orderBy: [desc(courseEquivalencyRules.priority), courseEquivalencyRules.externalCourseCode],
        limit: input.limit,
        offset: input.offset,
      });

      return {
        rules: rules.map((r) => ({
          id: r.id,
          agreementId: r.agreementId,
          agreementName: r.agreement?.name ?? null,
          externalInstitutionId: r.externalInstitutionId,
          externalInstitutionName: r.externalInstitution?.name ?? null,
          externalCourseCode: r.externalCourseCode,
          externalCourseTitle: r.externalCourseTitle,
          externalCreditsMin: r.externalCreditsMin,
          externalCreditsMax: r.externalCreditsMax,
          equivalentCourseId: r.equivalentCourseId,
          equivalentCourseCode: r.equivalentCourse?.courseCode ?? null,
          equivalentCourseTitle: r.equivalentCourse?.title ?? null,
          isElectiveCredit: r.isElectiveCredit,
          electiveCreditSubject: r.electiveCreditSubject,
          electiveCreditLevel: r.electiveCreditLevel,
          transferCreditsAwarded: r.transferCreditsAwarded,
          minimumGrade: r.minimumGrade,
          priority: r.priority,
          isActive: r.isActive,
          notes: r.notes,
        })),
      };
    }),

  /**
   * Create course equivalency rule
   */
  createEquivalencyRule: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid().optional(),
        externalInstitutionId: z.string().uuid().optional(),
        externalCourseCode: z.string().min(1).max(30),
        externalCourseTitle: z.string().max(200).optional(),
        externalCreditsMin: z.number().positive().optional(),
        externalCreditsMax: z.number().positive().optional(),
        equivalentCourseId: z.string().uuid().optional(),
        isElectiveCredit: z.boolean().default(false),
        electiveCreditSubject: z.string().max(50).optional(),
        electiveCreditLevel: z.string().max(10).optional(),
        transferCreditsAwarded: z.number().positive(),
        minimumGrade: z.string().max(5).optional(),
        priority: z.number().int().default(0),
        notes: z.string().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Must have either agreement or external institution
      if (!input.agreementId && !input.externalInstitutionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either agreementId or externalInstitutionId is required",
        });
      }

      // Must have either equivalent course or elective credit
      if (!input.equivalentCourseId && !input.isElectiveCredit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either equivalentCourseId or isElectiveCredit must be specified",
        });
      }

      const [rule] = await ctx.db
        .insert(courseEquivalencyRules)
        .values({
          ...input,
          externalCreditsMin: input.externalCreditsMin?.toString(),
          externalCreditsMax: input.externalCreditsMax?.toString(),
          transferCreditsAwarded: input.transferCreditsAwarded.toString(),
        })
        .returning();

      return { rule };
    }),

  /**
   * Update course equivalency rule
   */
  updateEquivalencyRule: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        externalCourseCode: z.string().min(1).max(30).optional(),
        externalCourseTitle: z.string().max(200).optional().nullable(),
        externalCreditsMin: z.number().positive().optional().nullable(),
        externalCreditsMax: z.number().positive().optional().nullable(),
        equivalentCourseId: z.string().uuid().optional().nullable(),
        isElectiveCredit: z.boolean().optional(),
        electiveCreditSubject: z.string().max(50).optional().nullable(),
        electiveCreditLevel: z.string().max(10).optional().nullable(),
        transferCreditsAwarded: z.number().positive().optional(),
        minimumGrade: z.string().max(5).optional().nullable(),
        priority: z.number().int().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional().nullable(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const { id, externalCreditsMin, externalCreditsMax, transferCreditsAwarded, ...rest } = input;

      const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (externalCreditsMin !== undefined) {
        updates["externalCreditsMin"] = externalCreditsMin?.toString() ?? null;
      }
      if (externalCreditsMax !== undefined) {
        updates["externalCreditsMax"] = externalCreditsMax?.toString() ?? null;
      }
      if (transferCreditsAwarded !== undefined) {
        updates["transferCreditsAwarded"] = transferCreditsAwarded.toString();
      }

      const [updated] = await ctx.db
        .update(courseEquivalencyRules)
        .set(updates)
        .where(eq(courseEquivalencyRules.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Equivalency rule not found",
        });
      }

      return { rule: updated };
    }),

  /**
   * Delete course equivalency rule
   */
  deleteEquivalencyRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(courseEquivalencyRules)
        .where(eq(courseEquivalencyRules.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Equivalency rule not found",
        });
      }

      return { success: true };
    }),

  /**
   * Find matching equivalency rules for a transfer credit
   * Used for automatic evaluation
   */
  findMatchingRules: protectedProcedure
    .input(
      z.object({
        externalInstitutionName: z.string(),
        externalCourseCode: z.string(),
        sourceCredits: z.number().positive(),
        sourceGrade: z.string().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      // First, find matching external institution
      const institution = await ctx.db.query.externalInstitutions.findFirst({
        where: ilike(externalInstitutions.name, `%${input.externalInstitutionName}%`),
      });

      if (!institution) {
        return { matchingRules: [], institutionFound: false };
      }

      // Find active agreements for this institution
      const agreements = await ctx.db.query.articulationAgreements.findMany({
        where: and(
          eq(articulationAgreements.externalInstitutionId, institution.id),
          eq(articulationAgreements.status, "active"),
          eq(articulationAgreements.autoApply, true)
        ),
      });

      const agreementIds = agreements.map((a) => a.id);

      // Find matching equivalency rules
      const rules = await ctx.db.query.courseEquivalencyRules.findMany({
        where: and(
          eq(courseEquivalencyRules.isActive, true),
          or(
            // Rules from active agreements
            agreementIds.length > 0
              ? sql`${courseEquivalencyRules.agreementId} = ANY(ARRAY[${sql.join(agreementIds.map(id => sql`${id}::uuid`), sql`, `)}])`
              : sql`false`,
            // Standalone rules for this institution
            eq(courseEquivalencyRules.externalInstitutionId, institution.id)
          )
        ),
        with: {
          equivalentCourse: true,
        },
        orderBy: [desc(courseEquivalencyRules.priority)],
      });

      // Filter rules that match the course code (supports wildcards)
      const matchingRules = rules.filter((rule) => {
        const pattern = rule.externalCourseCode.replace(/\*/g, ".*").replace(/\?/g, ".");
        const regex = new RegExp(`^${pattern}$`, "i");
        return regex.test(input.externalCourseCode);
      });

      return {
        matchingRules: matchingRules.map((r) => ({
          id: r.id,
          externalCourseCode: r.externalCourseCode,
          equivalentCourseId: r.equivalentCourseId,
          equivalentCourseCode: r.equivalentCourse?.courseCode ?? null,
          equivalentCourseTitle: r.equivalentCourse?.title ?? null,
          isElectiveCredit: r.isElectiveCredit,
          electiveCreditSubject: r.electiveCreditSubject,
          electiveCreditLevel: r.electiveCreditLevel,
          transferCreditsAwarded: r.transferCreditsAwarded,
          minimumGrade: r.minimumGrade,
          priority: r.priority,
        })),
        institutionFound: true,
        institutionId: institution.id,
        institutionName: institution.name,
      };
    }),

  /**
   * Apply equivalency rule to a transfer credit
   */
  applyEquivalencyRule: protectedProcedure
    .input(
      z.object({
        transferCreditId: z.string().uuid(),
        ruleId: z.string().uuid(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get the rule
      const rule = await ctx.db.query.courseEquivalencyRules.findFirst({
        where: eq(courseEquivalencyRules.id, input.ruleId),
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Equivalency rule not found",
        });
      }

      // Update the transfer credit
      const now = new Date();
      const [updated] = await ctx.db
        .update(transferCredits)
        .set({
          equivalentCourseId: rule.equivalentCourseId,
          transferCredits: rule.transferCreditsAwarded,
          status: "approved",
          evaluatedBy: ctx.user.id,
          evaluatedAt: now,
          evaluationNotes: `Auto-applied from equivalency rule: ${rule.externalCourseCode}`,
          updatedAt: now,
        })
        .where(eq(transferCredits.id, input.transferCreditId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transfer credit not found",
        });
      }

      return { transferCredit: updated };
    }),
});
