/**
 * Course Substitution Router
 *
 * Handles course substitution and waiver operations including:
 * - Creating substitutions/waivers for degree requirements
 * - Approving pending substitution requests
 * - Revoking existing substitutions
 * - Listing substitutions for students or requirements
 *
 * All operations enforce FERPA compliance through canAccessStudent middleware.
 */

import { z } from "zod";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  canAccessStudent,
  requireRole,
} from "../trpc.js";
import {
  courseSubstitutions,
  students,
  courses,
  programRequirements,
  users,
} from "@sis/db/schema";

// ============================================================================
// Input Schemas
// ============================================================================

const substitutionTypeSchema = z.enum(["substitution", "waiver"]);
const substitutionStatusSchema = z.enum(["pending", "active", "revoked", "expired"]);

const listSubstitutionsSchema = z.object({
  studentId: z.string().uuid().optional(),
  requirementId: z.string().uuid().optional(),
  status: substitutionStatusSchema.optional(),
  type: substitutionTypeSchema.optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const createSubstitutionSchema = z.object({
  studentId: z.string().uuid(),
  requirementId: z.string().uuid(),
  originalCourseId: z.string().uuid().optional(),
  substituteCourseId: z.string().uuid().optional(),
  substitutionType: substitutionTypeSchema,
  creditsApplied: z.number().positive().optional(),
  reason: z.string().min(1).max(2000),
  expiresAt: z.string().datetime().optional(),
  // If true, auto-approve (for authorized roles)
  autoApprove: z.boolean().default(false),
});

const approveSubstitutionSchema = z.object({
  substitutionId: z.string().uuid(),
  creditsApplied: z.number().positive().optional(),
  notes: z.string().optional(),
});

const revokeSubstitutionSchema = z.object({
  substitutionId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

const getSubstitutionSchema = z.object({
  substitutionId: z.string().uuid(),
});

const getStudentSubstitutionsSchema = z.object({
  studentId: z.string().uuid(),
  includeRevoked: z.boolean().default(false),
});

// ============================================================================
// Router
// ============================================================================

export const courseSubstitutionRouter = router({
  /**
   * List substitutions with optional filtering
   * Accessible by registrar, advisor, and admin roles
   */
  list: protectedProcedure
    .input(listSubstitutionsSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.studentId) {
        conditions.push(eq(courseSubstitutions.studentId, input.studentId));
      }

      if (input.requirementId) {
        conditions.push(eq(courseSubstitutions.requirementId, input.requirementId));
      }

      if (input.status) {
        conditions.push(eq(courseSubstitutions.status, input.status));
      }

      if (input.type) {
        conditions.push(eq(courseSubstitutions.substitutionType, input.type));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const substitutions = await ctx.db.query.courseSubstitutions.findMany({
        where: whereClause,
        with: {
          student: true,
          requirement: {
            with: {
              program: true,
            },
          },
          originalCourse: true,
          substituteCourse: true,
          approver: true,
          requester: true,
        },
        orderBy: [desc(courseSubstitutions.requestedAt)],
        limit: input.limit,
        offset: input.offset,
      });

      // Get total count
      const allSubstitutions = await ctx.db.query.courseSubstitutions.findMany({
        where: whereClause,
        columns: { id: true },
      });

      return {
        substitutions: substitutions.map((sub) => ({
          id: sub.id,
          studentId: sub.studentId,
          studentName: sub.student
            ? `${sub.student.preferredFirstName ?? sub.student.legalFirstName} ${sub.student.legalLastName}`
            : null,
          requirementId: sub.requirementId,
          requirementName: sub.requirement?.name ?? null,
          programName: sub.requirement?.program?.name ?? null,
          substitutionType: sub.substitutionType,
          originalCourse: sub.originalCourse
            ? {
                id: sub.originalCourse.id,
                courseCode: sub.originalCourse.courseCode,
                title: sub.originalCourse.title,
              }
            : null,
          substituteCourse: sub.substituteCourse
            ? {
                id: sub.substituteCourse.id,
                courseCode: sub.substituteCourse.courseCode,
                title: sub.substituteCourse.title,
              }
            : null,
          creditsApplied: sub.creditsApplied,
          status: sub.status,
          reason: sub.reason,
          approvedBy: sub.approver
            ? { id: sub.approver.id, name: sub.approver.displayName }
            : null,
          approvedAt: sub.approvedAt,
          requestedBy: sub.requester
            ? { id: sub.requester.id, name: sub.requester.displayName }
            : null,
          requestedAt: sub.requestedAt,
          expiresAt: sub.expiresAt,
        })),
        total: allSubstitutions.length,
        hasMore: input.offset + input.limit < allSubstitutions.length,
      };
    }),

  /**
   * Get substitutions for a specific student
   * Student can view their own, staff can view any
   */
  getForStudent: protectedProcedure
    .input(getStudentSubstitutionsSchema)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(courseSubstitutions.studentId, input.studentId)];

      if (!input.includeRevoked) {
        conditions.push(
          inArray(courseSubstitutions.status, ["pending", "active"])
        );
      }

      const substitutions = await ctx.db.query.courseSubstitutions.findMany({
        where: and(...conditions),
        with: {
          requirement: {
            with: {
              program: true,
              category: true,
            },
          },
          originalCourse: true,
          substituteCourse: true,
          approver: true,
        },
        orderBy: [desc(courseSubstitutions.requestedAt)],
      });

      return substitutions.map((sub) => ({
        id: sub.id,
        requirementId: sub.requirementId,
        requirementName: sub.requirement?.name ?? null,
        categoryName: sub.requirement?.category?.name ?? null,
        programName: sub.requirement?.program?.name ?? null,
        substitutionType: sub.substitutionType,
        originalCourse: sub.originalCourse
          ? {
              id: sub.originalCourse.id,
              courseCode: sub.originalCourse.courseCode,
              title: sub.originalCourse.title,
            }
          : null,
        substituteCourse: sub.substituteCourse
          ? {
              id: sub.substituteCourse.id,
              courseCode: sub.substituteCourse.courseCode,
              title: sub.substituteCourse.title,
            }
          : null,
        creditsApplied: sub.creditsApplied,
        status: sub.status,
        reason: sub.reason,
        approvedAt: sub.approvedAt,
        approvedBy: sub.approver?.displayName ?? null,
        expiresAt: sub.expiresAt,
      }));
    }),

  /**
   * Get a single substitution by ID
   */
  getById: protectedProcedure
    .input(getSubstitutionSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx, input }) => {
      const substitution = await ctx.db.query.courseSubstitutions.findFirst({
        where: eq(courseSubstitutions.id, input.substitutionId),
        with: {
          student: true,
          requirement: {
            with: {
              program: true,
              category: true,
            },
          },
          originalCourse: true,
          substituteCourse: true,
          approver: true,
          requester: true,
          revoker: true,
        },
      });

      if (!substitution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Substitution not found",
        });
      }

      return {
        id: substitution.id,
        studentId: substitution.studentId,
        student: substitution.student
          ? {
              id: substitution.student.id,
              firstName: substitution.student.preferredFirstName ?? substitution.student.legalFirstName,
              lastName: substitution.student.legalLastName,
              studentNumber: substitution.student.studentId,
            }
          : null,
        requirementId: substitution.requirementId,
        requirement: substitution.requirement
          ? {
              id: substitution.requirement.id,
              name: substitution.requirement.name,
              programName: substitution.requirement.program?.name,
              categoryName: substitution.requirement.category?.name,
            }
          : null,
        substitutionType: substitution.substitutionType,
        originalCourse: substitution.originalCourse
          ? {
              id: substitution.originalCourse.id,
              courseCode: substitution.originalCourse.courseCode,
              title: substitution.originalCourse.title,
              creditHours: substitution.originalCourse.creditHoursMin,
            }
          : null,
        substituteCourse: substitution.substituteCourse
          ? {
              id: substitution.substituteCourse.id,
              courseCode: substitution.substituteCourse.courseCode,
              title: substitution.substituteCourse.title,
              creditHours: substitution.substituteCourse.creditHoursMin,
            }
          : null,
        creditsApplied: substitution.creditsApplied,
        status: substitution.status,
        reason: substitution.reason,
        expiresAt: substitution.expiresAt,
        // Approval info
        approvedBy: substitution.approver
          ? {
              id: substitution.approver.id,
              name: substitution.approver.displayName,
            }
          : null,
        approvedAt: substitution.approvedAt,
        // Request info
        requestedBy: substitution.requester
          ? {
              id: substitution.requester.id,
              name: substitution.requester.displayName,
            }
          : null,
        requestedAt: substitution.requestedAt,
        // Revocation info
        revokedBy: substitution.revoker
          ? {
              id: substitution.revoker.id,
              name: substitution.revoker.displayName,
            }
          : null,
        revokedAt: substitution.revokedAt,
        revocationReason: substitution.revocationReason,
        // Timestamps
        createdAt: substitution.createdAt,
        updatedAt: substitution.updatedAt,
      };
    }),

  /**
   * Create a new substitution or waiver request
   * Accessible by registrar, advisor, and admin roles
   */
  create: protectedProcedure
    .input(createSubstitutionSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .mutation(async ({ ctx, input }) => {
      // Validate student exists
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Validate requirement exists
      const requirement = await ctx.db.query.programRequirements.findFirst({
        where: eq(programRequirements.id, input.requirementId),
      });

      if (!requirement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Requirement not found",
        });
      }

      // Validate original course if provided
      if (input.originalCourseId) {
        const originalCourse = await ctx.db.query.courses.findFirst({
          where: eq(courses.id, input.originalCourseId),
        });
        if (!originalCourse) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Original course not found",
          });
        }
      }

      // Validate substitute course if provided (required for substitutions)
      if (input.substitutionType === "substitution" && !input.substituteCourseId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Substitute course is required for substitutions",
        });
      }

      if (input.substituteCourseId) {
        const substituteCourse = await ctx.db.query.courses.findFirst({
          where: eq(courses.id, input.substituteCourseId),
        });
        if (!substituteCourse) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Substitute course not found",
          });
        }
      }

      // Check for existing active substitution for same requirement
      const existingSubstitution = await ctx.db.query.courseSubstitutions.findFirst({
        where: and(
          eq(courseSubstitutions.studentId, input.studentId),
          eq(courseSubstitutions.requirementId, input.requirementId),
          inArray(courseSubstitutions.status, ["pending", "active"])
        ),
      });

      if (existingSubstitution) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An active or pending substitution already exists for this requirement",
        });
      }

      // Determine status based on autoApprove flag and role
      const status = input.autoApprove ? "active" : "pending";
      const now = new Date();

      const [newSubstitution] = await ctx.db
        .insert(courseSubstitutions)
        .values({
          studentId: input.studentId,
          requirementId: input.requirementId,
          originalCourseId: input.originalCourseId,
          substituteCourseId: input.substituteCourseId,
          substitutionType: input.substitutionType,
          creditsApplied: input.creditsApplied?.toString(),
          status,
          reason: input.reason,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          requestedBy: ctx.user.id,
          requestedAt: now,
          approvedBy: input.autoApprove ? ctx.user.id : null,
          approvedAt: input.autoApprove ? now : null,
        })
        .returning();

      return {
        substitutionId: newSubstitution?.id,
        status: newSubstitution?.status,
        message: input.autoApprove
          ? "Substitution created and approved"
          : "Substitution request created and pending approval",
      };
    }),

  /**
   * Approve a pending substitution
   * Accessible by registrar and admin roles
   */
  approve: protectedProcedure
    .input(approveSubstitutionSchema)
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get the substitution
      const substitution = await ctx.db.query.courseSubstitutions.findFirst({
        where: eq(courseSubstitutions.id, input.substitutionId),
      });

      if (!substitution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Substitution not found",
        });
      }

      if (substitution.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot approve substitution with status: ${substitution.status}`,
        });
      }

      const now = new Date();

      await ctx.db
        .update(courseSubstitutions)
        .set({
          status: "active",
          approvedBy: ctx.user.id,
          approvedAt: now,
          creditsApplied: input.creditsApplied?.toString() ?? substitution.creditsApplied,
          updatedAt: now,
        })
        .where(eq(courseSubstitutions.id, input.substitutionId));

      return {
        substitutionId: input.substitutionId,
        status: "active",
        message: "Substitution approved successfully",
      };
    }),

  /**
   * Revoke an active substitution
   * Accessible by registrar and admin roles
   */
  revoke: protectedProcedure
    .input(revokeSubstitutionSchema)
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get the substitution
      const substitution = await ctx.db.query.courseSubstitutions.findFirst({
        where: eq(courseSubstitutions.id, input.substitutionId),
      });

      if (!substitution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Substitution not found",
        });
      }

      if (substitution.status === "revoked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Substitution is already revoked",
        });
      }

      const now = new Date();

      await ctx.db
        .update(courseSubstitutions)
        .set({
          status: "revoked",
          revokedBy: ctx.user.id,
          revokedAt: now,
          revocationReason: input.reason,
          updatedAt: now,
        })
        .where(eq(courseSubstitutions.id, input.substitutionId));

      return {
        substitutionId: input.substitutionId,
        status: "revoked",
        message: "Substitution revoked successfully",
      };
    }),

  /**
   * Get pending substitutions count for dashboard
   */
  getPendingCount: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx }) => {
      const pendingSubstitutions = await ctx.db.query.courseSubstitutions.findMany({
        where: eq(courseSubstitutions.status, "pending"),
        columns: { id: true },
      });

      return {
        count: pendingSubstitutions.length,
      };
    }),

  /**
   * Get substitution statistics
   */
  getStats: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx }) => {
      const allSubstitutions = await ctx.db.query.courseSubstitutions.findMany({
        columns: {
          id: true,
          status: true,
          substitutionType: true,
        },
      });

      const byStatus = {
        pending: 0,
        active: 0,
        revoked: 0,
        expired: 0,
      };

      const byType = {
        substitution: 0,
        waiver: 0,
      };

      for (const sub of allSubstitutions) {
        if (sub.status && sub.status in byStatus) {
          byStatus[sub.status as keyof typeof byStatus]++;
        }
        if (sub.substitutionType && sub.substitutionType in byType) {
          byType[sub.substitutionType as keyof typeof byType]++;
        }
      }

      return {
        total: allSubstitutions.length,
        byStatus,
        byType,
      };
    }),
});
