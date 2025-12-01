/**
 * Holds Router
 *
 * tRPC router for managing registration holds.
 * Holds can prevent students from registering, viewing grades, or receiving transcripts.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { registrationHolds, students } from "@sis/db/schema";

export const holdsRouter = router({
  /**
   * List holds with optional filtering
   */
  list: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid().optional(),
        holdType: z
          .enum(["academic", "financial", "administrative", "disciplinary"])
          .optional(),
        status: z.enum(["active", "resolved"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const filters = [];

      // Filter by student if provided
      if (input.studentId) {
        filters.push(eq(registrationHolds.studentId, input.studentId));
      } else {
        // If no specific student, ensure we only get holds from this institution
        // This is done via a join with students table
      }

      // Filter by hold type
      if (input.holdType) {
        filters.push(eq(registrationHolds.holdType, input.holdType));
      }

      // Filter by status (active = not resolved, resolved = has resolvedAt date)
      if (input.status === "active") {
        filters.push(isNull(registrationHolds.resolvedAt));
      } else if (input.status === "resolved") {
        filters.push(isNotNull(registrationHolds.resolvedAt));
      }

      // Query holds with student information
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: filters.length > 0 ? and(...filters) : undefined,
        limit: input.limit,
        offset: input.offset,
        orderBy: (registrationHolds, { desc }) => [
          desc(registrationHolds.effectiveFrom),
        ],
        with: {
          student: {
            columns: {
              id: true,
              studentId: true,
              legalFirstName: true,
              legalLastName: true,
              preferredFirstName: true,
              primaryEmail: true,
              institutionId: true,
            },
          },
          placedByUser: {
            columns: {
              id: true,
              email: true,
            },
          },
          resolvedByUser: {
            columns: {
              id: true,
              email: true,
            },
          },
        },
      });

      // Filter by institution
      const filteredHolds = holds.filter(
        (hold) => hold.student?.institutionId === ctx.user!.institutionId
      );

      return {
        holds: filteredHolds.map((hold) => ({
          id: hold.id,
          student: hold.student
            ? {
                id: hold.student.id,
                studentId: hold.student.studentId,
                firstName:
                  hold.student.preferredFirstName ??
                  hold.student.legalFirstName,
                lastName: hold.student.legalLastName,
                email: hold.student.primaryEmail,
              }
            : null,
          holdType: hold.holdType,
          holdCode: hold.holdCode,
          holdName: hold.holdName,
          description: hold.description,
          blocksRegistration: hold.blocksRegistration,
          blocksGrades: hold.blocksGrades,
          blocksTranscript: hold.blocksTranscript,
          blocksDiploma: hold.blocksDiploma,
          releaseAuthority: hold.releaseAuthority,
          effectiveFrom: hold.effectiveFrom,
          effectiveUntil: hold.effectiveUntil,
          resolvedAt: hold.resolvedAt,
          resolvedBy: hold.resolvedByUser?.email ?? null,
          resolutionNotes: hold.resolutionNotes,
          placedBy: hold.placedByUser?.email ?? null,
          placedByOffice: hold.placedByOffice,
          createdAt: hold.createdAt,
        })),
        total: filteredHolds.length,
      };
    }),

  /**
   * Create a new hold
   */
  create: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        holdType: z.enum([
          "academic",
          "financial",
          "administrative",
          "disciplinary",
        ]),
        holdCode: z.string().min(1).max(20),
        holdName: z.string().min(1).max(100),
        description: z.string().optional(),
        blocksRegistration: z.boolean().default(true),
        blocksGrades: z.boolean().default(false),
        blocksTranscript: z.boolean().default(false),
        blocksDiploma: z.boolean().default(false),
        releaseAuthority: z.string().max(50).optional(),
        effectiveUntil: z.string().datetime().optional(),
        placedByOffice: z.string().max(100).optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Verify student exists and belongs to same institution
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      if (student.institutionId !== ctx.user!.institutionId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot create hold for student from different institution",
        });
      }

      // Create the hold
      const result = await ctx.db
        .insert(registrationHolds)
        .values({
          studentId: input.studentId,
          holdType: input.holdType,
          holdCode: input.holdCode,
          holdName: input.holdName,
          description: input.description ?? null,
          blocksRegistration: input.blocksRegistration,
          blocksGrades: input.blocksGrades,
          blocksTranscript: input.blocksTranscript,
          blocksDiploma: input.blocksDiploma,
          releaseAuthority: input.releaseAuthority ?? null,
          effectiveFrom: new Date(),
          effectiveUntil: input.effectiveUntil
            ? new Date(input.effectiveUntil)
            : null,
          placedBy: ctx.user!.id,
          placedByOffice: input.placedByOffice ?? null,
        })
        .returning({ id: registrationHolds.id });

      const newHold = result[0];
      if (!newHold) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create hold",
        });
      }

      return {
        id: newHold.id,
        message: "Hold created successfully",
      };
    }),

  /**
   * Release (resolve) a hold
   */
  release: protectedProcedure
    .input(
      z.object({
        holdId: z.string().uuid(),
        resolutionNotes: z.string().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get the hold with student information
      const hold = await ctx.db.query.registrationHolds.findFirst({
        where: eq(registrationHolds.id, input.holdId),
        with: {
          student: {
            columns: {
              institutionId: true,
            },
          },
        },
      });

      if (!hold) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold not found",
        });
      }

      // Verify hold belongs to same institution
      if (hold.student?.institutionId !== ctx.user!.institutionId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot release hold from different institution",
        });
      }

      // Check if already resolved
      if (hold.resolvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Hold has already been resolved",
        });
      }

      // Release the hold
      await ctx.db
        .update(registrationHolds)
        .set({
          resolvedAt: new Date(),
          resolvedBy: ctx.user!.id,
          resolutionNotes: input.resolutionNotes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(registrationHolds.id, input.holdId));

      return {
        message: "Hold released successfully",
      };
    }),

  /**
   * Get holds for a specific student (simpler response for registration page)
   */
  getStudentHolds: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx, input }) => {
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: eq(registrationHolds.studentId, input.studentId),
        orderBy: (registrationHolds, { desc }) => [
          desc(registrationHolds.effectiveFrom),
        ],
      });

      return holds.map((hold) => ({
        id: hold.id,
        holdType: hold.holdType,
        holdCode: hold.holdCode,
        holdName: hold.holdName,
        description: hold.description,
        blocksRegistration: hold.blocksRegistration,
        blocksGrades: hold.blocksGrades,
        blocksTranscript: hold.blocksTranscript,
        blocksDiploma: hold.blocksDiploma,
        effectiveFrom: hold.effectiveFrom,
        effectiveUntil: hold.effectiveUntil,
        resolvedAt: hold.resolvedAt,
      }));
    }),
});
