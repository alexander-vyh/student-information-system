/**
 * Holds Router
 *
 * tRPC router for managing registration holds.
 * Holds can prevent students from registering, viewing grades, or receiving transcripts.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import { eq, and, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { registrationHolds, students, holdTypes, users, type HoldAutomationRule } from "@sis/db/schema";
import { sendHoldNotification } from "../lib/email/index.js";

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
          holdTypeConfig: {
            columns: {
              id: true,
              code: true,
              name: true,
              category: true,
              severity: true,
              resolutionInstructions: true,
              resolutionUrl: true,
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
          holdTypeId: hold.holdTypeId,
          holdTypeConfig: hold.holdTypeConfig
            ? {
                id: hold.holdTypeConfig.id,
                code: hold.holdTypeConfig.code,
                name: hold.holdTypeConfig.name,
                category: hold.holdTypeConfig.category,
                severity: hold.holdTypeConfig.severity,
                resolutionInstructions: hold.holdTypeConfig.resolutionInstructions,
                resolutionUrl: hold.holdTypeConfig.resolutionUrl,
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
   * Can use holdTypeId to create from configured type, or provide details manually
   */
  create: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        // Option 1: Use a configured hold type
        holdTypeId: z.string().uuid().optional(),
        // Option 2: Provide hold details manually (required if no holdTypeId)
        holdType: z.enum([
          "academic",
          "financial",
          "administrative",
          "disciplinary",
        ]).optional(),
        holdCode: z.string().min(1).max(20).optional(),
        holdName: z.string().min(1).max(100).optional(),
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

      // Determine hold details based on holdTypeId or manual input
      let holdDetails: {
        holdTypeId: string | null;
        holdType: string;
        holdCode: string;
        holdName: string;
        description: string | null;
        blocksRegistration: boolean;
        blocksGrades: boolean;
        blocksTranscript: boolean;
        blocksDiploma: boolean;
        releaseAuthority: string | null;
      };

      if (input.holdTypeId) {
        // Fetch hold type configuration
        const type = await ctx.db.query.holdTypes.findFirst({
          where: and(
            eq(holdTypes.id, input.holdTypeId),
            eq(holdTypes.institutionId, ctx.user!.institutionId),
            isNull(holdTypes.validTo) // Must be current version
          ),
        });

        if (!type) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Hold type not found or is not current version",
          });
        }

        holdDetails = {
          holdTypeId: type.id,
          holdType: type.category,
          holdCode: type.code,
          holdName: type.name,
          description: input.description ?? type.description,
          blocksRegistration: type.blocksRegistration ?? true,
          blocksGrades: type.blocksGrades ?? false,
          blocksTranscript: type.blocksTranscript ?? false,
          blocksDiploma: type.blocksDiploma ?? false,
          releaseAuthority: type.releaseAuthority,
        };
      } else {
        // Manual input - validate required fields
        if (!input.holdType || !input.holdCode || !input.holdName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Must provide holdTypeId or holdType, holdCode, and holdName",
          });
        }

        holdDetails = {
          holdTypeId: null,
          holdType: input.holdType,
          holdCode: input.holdCode,
          holdName: input.holdName,
          description: input.description ?? null,
          blocksRegistration: input.blocksRegistration,
          blocksGrades: input.blocksGrades,
          blocksTranscript: input.blocksTranscript,
          blocksDiploma: input.blocksDiploma,
          releaseAuthority: input.releaseAuthority ?? null,
        };
      }

      // Create the hold
      const result = await ctx.db
        .insert(registrationHolds)
        .values({
          studentId: input.studentId,
          holdTypeId: holdDetails.holdTypeId,
          holdType: holdDetails.holdType,
          holdCode: holdDetails.holdCode,
          holdName: holdDetails.holdName,
          description: holdDetails.description,
          blocksRegistration: holdDetails.blocksRegistration,
          blocksGrades: holdDetails.blocksGrades,
          blocksTranscript: holdDetails.blocksTranscript,
          blocksDiploma: holdDetails.blocksDiploma,
          releaseAuthority: holdDetails.releaseAuthority,
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

      // Send email notification to student
      try {
        // Get student with user email
        const studentWithUser = await ctx.db.query.students.findFirst({
          where: eq(students.id, input.studentId),
          with: {
            user: {
              columns: {
                email: true,
              },
            },
          },
        });

        if (studentWithUser?.user?.email) {
          // Build list of blocked actions
          const blockedActions: string[] = [];
          if (holdDetails.blocksRegistration) blockedActions.push("Course Registration");
          if (holdDetails.blocksGrades) blockedActions.push("Viewing Grades");
          if (holdDetails.blocksTranscript) blockedActions.push("Requesting Transcripts");
          if (holdDetails.blocksDiploma) blockedActions.push("Receiving Diploma");

          const studentName = `${studentWithUser.preferredFirstName ?? studentWithUser.legalFirstName} ${studentWithUser.preferredLastName ?? studentWithUser.legalLastName}`;

          // Send notification email
          await sendHoldNotification({
            to: studentWithUser.user.email,
            studentName,
            holdType: holdDetails.holdName,
            holdReason: holdDetails.description ?? "No additional information provided",
            blockedActions,
            contactOffice: holdDetails.releaseAuthority ?? "Registrar's Office",
            contactEmail: undefined, // TODO: Add office email lookup
            contactPhone: undefined, // TODO: Add office phone lookup
          });

          console.log(`[Holds] Notification email sent to ${studentWithUser.user.email} for hold ${newHold.id}`);
        }
      } catch (emailError) {
        // Don't fail the hold creation if email fails
        console.error("[Holds] Failed to send hold notification email:", emailError);
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

      // Send email notification to student about hold clearance
      try {
        // Get student with user email
        const studentWithUser = await ctx.db.query.students.findFirst({
          where: eq(students.id, hold.studentId),
          with: {
            user: {
              columns: {
                email: true,
              },
            },
          },
        });

        if (studentWithUser?.user?.email) {
          // Build list of actions that are now unblocked
          const unblockedActions: string[] = [];
          if (hold.blocksRegistration) unblockedActions.push("Course Registration");
          if (hold.blocksGrades) unblockedActions.push("Viewing Grades");
          if (hold.blocksTranscript) unblockedActions.push("Requesting Transcripts");
          if (hold.blocksDiploma) unblockedActions.push("Receiving Diploma");

          const studentName = `${studentWithUser.preferredFirstName ?? studentWithUser.legalFirstName} ${studentWithUser.preferredLastName ?? studentWithUser.legalLastName}`;

          // Send notification email (reusing the template with cleared status messaging)
          await sendHoldNotification({
            to: studentWithUser.user.email,
            studentName,
            holdType: `${hold.holdName} - CLEARED`,
            holdReason: input.resolutionNotes
              ? `This hold has been cleared. Resolution: ${input.resolutionNotes}`
              : "This hold has been cleared and is no longer active on your account.",
            blockedActions: unblockedActions.length > 0
              ? [`You can now: ${unblockedActions.join(", ")}`]
              : ["No restrictions were in place"],
            contactOffice: hold.releaseAuthority ?? "Registrar's Office",
            contactEmail: undefined,
            contactPhone: undefined,
          });

          console.log(`[Holds] Clearance notification email sent to ${studentWithUser.user.email} for hold ${hold.id}`);
        }
      } catch (emailError) {
        // Don't fail the hold release if email fails
        console.error("[Holds] Failed to send hold clearance notification email:", emailError);
      }

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

  // ==========================================================================
  // HOLD TYPES MANAGEMENT
  // ==========================================================================

  /**
   * List all hold types for the institution
   * Uses temporal query pattern - only returns current versions (validTo IS NULL)
   */
  listHoldTypes: protectedProcedure
    .input(
      z.object({
        category: z
          .enum(["academic", "financial", "administrative", "disciplinary"])
          .optional(),
        activeOnly: z.boolean().default(true),
        includeHistory: z.boolean().default(false), // Set true to see historical versions
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const filters = [eq(holdTypes.institutionId, ctx.user!.institutionId)];

      // By default, only show current versions (validTo IS NULL)
      if (!input.includeHistory) {
        filters.push(isNull(holdTypes.validTo));
      }

      if (input.activeOnly) {
        filters.push(eq(holdTypes.isActive, true));
      }

      if (input.category) {
        filters.push(eq(holdTypes.category, input.category));
      }

      const types = await ctx.db.query.holdTypes.findMany({
        where: and(...filters),
        orderBy: (holdTypes, { asc }) => [
          asc(holdTypes.category),
          asc(holdTypes.code),
        ],
        with: {
          changedByUser: {
            columns: { id: true, email: true },
          },
        },
      });

      return types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        category: t.category,
        blocksRegistration: t.blocksRegistration,
        blocksGrades: t.blocksGrades,
        blocksTranscript: t.blocksTranscript,
        blocksDiploma: t.blocksDiploma,
        blocksGraduation: t.blocksGraduation,
        releaseAuthority: t.releaseAuthority,
        releaseAuthorityEmail: t.releaseAuthorityEmail,
        resolutionInstructions: t.resolutionInstructions,
        resolutionUrl: t.resolutionUrl,
        isAutomated: t.isAutomated,
        automationRule: t.automationRule,
        severity: t.severity,
        isActive: t.isActive,
        // Temporal fields
        validFrom: t.validFrom,
        validTo: t.validTo,
        changedBy: t.changedByUser?.email ?? null,
        changeReason: t.changeReason,
      }));
    }),

  /**
   * Get a single hold type by ID
   */
  getHoldType: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const holdType = await ctx.db.query.holdTypes.findFirst({
        where: and(
          eq(holdTypes.id, input.id),
          eq(holdTypes.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!holdType) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold type not found",
        });
      }

      return holdType;
    }),

  /**
   * Create a new hold type
   */
  createHoldType: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(30),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        category: z.enum(["academic", "financial", "administrative", "disciplinary"]),
        blocksRegistration: z.boolean().default(true),
        blocksGrades: z.boolean().default(false),
        blocksTranscript: z.boolean().default(false),
        blocksDiploma: z.boolean().default(false),
        blocksGraduation: z.boolean().default(false),
        releaseAuthority: z.string().max(100).optional(),
        releaseAuthorityEmail: z.string().email().optional(),
        resolutionInstructions: z.string().optional(),
        resolutionUrl: z.string().url().optional(),
        isAutomated: z.boolean().default(false),
        automationRule: z
          .object({
            type: z.enum(["balance_threshold", "missing_document", "academic_standing", "custom"]),
            balanceThreshold: z.number().optional(),
            balanceAgeDays: z.number().optional(),
            standingValues: z.array(z.string()).optional(),
            customCondition: z.string().optional(),
          })
          .optional(),
        severity: z.enum(["low", "standard", "high", "critical"]).default("standard"),
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      // Check if code already exists
      const existing = await ctx.db.query.holdTypes.findFirst({
        where: and(
          eq(holdTypes.institutionId, ctx.user!.institutionId),
          eq(holdTypes.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Hold type with code "${input.code}" already exists`,
        });
      }

      const result = await ctx.db
        .insert(holdTypes)
        .values({
          institutionId: ctx.user!.institutionId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          category: input.category,
          blocksRegistration: input.blocksRegistration,
          blocksGrades: input.blocksGrades,
          blocksTranscript: input.blocksTranscript,
          blocksDiploma: input.blocksDiploma,
          blocksGraduation: input.blocksGraduation,
          releaseAuthority: input.releaseAuthority ?? null,
          releaseAuthorityEmail: input.releaseAuthorityEmail ?? null,
          resolutionInstructions: input.resolutionInstructions ?? null,
          resolutionUrl: input.resolutionUrl ?? null,
          isAutomated: input.isAutomated,
          automationRule: input.automationRule as HoldAutomationRule ?? null,
          severity: input.severity,
        })
        .returning({ id: holdTypes.id });

      return { id: result[0]!.id, message: "Hold type created successfully" };
    }),

  /**
   * Update a hold type using temporal pattern
   * Creates a new version with updated values while preserving history
   */
  updateHoldType: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        blocksRegistration: z.boolean().optional(),
        blocksGrades: z.boolean().optional(),
        blocksTranscript: z.boolean().optional(),
        blocksDiploma: z.boolean().optional(),
        blocksGraduation: z.boolean().optional(),
        releaseAuthority: z.string().max(100).optional(),
        releaseAuthorityEmail: z.string().email().optional(),
        resolutionInstructions: z.string().optional(),
        resolutionUrl: z.string().url().optional(),
        isAutomated: z.boolean().optional(),
        automationRule: z
          .object({
            type: z.enum(["balance_threshold", "missing_document", "academic_standing", "custom"]),
            balanceThreshold: z.number().optional(),
            balanceAgeDays: z.number().optional(),
            standingValues: z.array(z.string()).optional(),
            customCondition: z.string().optional(),
          })
          .optional(),
        severity: z.enum(["low", "standard", "high", "critical"]).optional(),
        isActive: z.boolean().optional(),
        changeReason: z.string().max(100).optional(), // Required for audit trail
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const { id, changeReason, ...updates } = input;

      // Verify hold type exists, belongs to institution, and is current version
      const existing = await ctx.db.query.holdTypes.findFirst({
        where: and(
          eq(holdTypes.id, id),
          eq(holdTypes.institutionId, ctx.user!.institutionId),
          isNull(holdTypes.validTo) // Must be current version
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold type not found or is not the current version",
        });
      }

      const now = new Date();

      // Temporal pattern: close current record and create new version
      await ctx.db.transaction(async (tx) => {
        // 1. Close the current record by setting validTo
        await tx
          .update(holdTypes)
          .set({
            validTo: now,
            updatedAt: now,
          })
          .where(eq(holdTypes.id, id));

        // 2. Create new version with updated values
        await tx.insert(holdTypes).values({
          institutionId: existing.institutionId,
          code: existing.code, // Code cannot change
          category: existing.category, // Category cannot change
          name: updates.name ?? existing.name,
          description: updates.description ?? existing.description,
          blocksRegistration: updates.blocksRegistration ?? existing.blocksRegistration,
          blocksGrades: updates.blocksGrades ?? existing.blocksGrades,
          blocksTranscript: updates.blocksTranscript ?? existing.blocksTranscript,
          blocksDiploma: updates.blocksDiploma ?? existing.blocksDiploma,
          blocksGraduation: updates.blocksGraduation ?? existing.blocksGraduation,
          releaseAuthority: updates.releaseAuthority ?? existing.releaseAuthority,
          releaseAuthorityEmail: updates.releaseAuthorityEmail ?? existing.releaseAuthorityEmail,
          resolutionInstructions: updates.resolutionInstructions ?? existing.resolutionInstructions,
          resolutionUrl: updates.resolutionUrl ?? existing.resolutionUrl,
          isAutomated: updates.isAutomated ?? existing.isAutomated,
          automationRule: (updates.automationRule as HoldAutomationRule) ?? existing.automationRule,
          severity: updates.severity ?? existing.severity,
          isActive: updates.isActive ?? existing.isActive,
          validFrom: now,
          validTo: null, // Current version
          changedBy: ctx.user!.id,
          changeReason: changeReason ?? null,
        });
      });

      return { message: "Hold type updated successfully (new version created)" };
    }),

  /**
   * Delete (deactivate) a hold type
   */
  deleteHoldType: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.holdTypes.findFirst({
        where: and(
          eq(holdTypes.id, input.id),
          eq(holdTypes.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold type not found",
        });
      }

      // Soft delete
      await ctx.db
        .update(holdTypes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(holdTypes.id, input.id));

      return { message: "Hold type deactivated successfully" };
    }),

  /**
   * Toggle hold type active status
   */
  toggleHoldTypeActive: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.holdTypes.findFirst({
        where: and(
          eq(holdTypes.id, input.id),
          eq(holdTypes.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hold type not found",
        });
      }

      await ctx.db
        .update(holdTypes)
        .set({ isActive: input.isActive, updatedAt: new Date() })
        .where(eq(holdTypes.id, input.id));

      return { message: `Hold type ${input.isActive ? "activated" : "deactivated"} successfully` };
    }),

  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================

  /**
   * Create holds in batch (for multiple students)
   */
  createBatch: protectedProcedure
    .input(
      z.object({
        studentIds: z.array(z.string().uuid()).min(1).max(500),
        holdTypeId: z.string().uuid().optional(),
        // If not using a holdType, provide details:
        holdType: z.enum(["academic", "financial", "administrative", "disciplinary"]).optional(),
        holdCode: z.string().min(1).max(20).optional(),
        holdName: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        blocksRegistration: z.boolean().optional(),
        blocksGrades: z.boolean().optional(),
        blocksTranscript: z.boolean().optional(),
        blocksDiploma: z.boolean().optional(),
        releaseAuthority: z.string().max(50).optional(),
        effectiveUntil: z.string().datetime().optional(),
        placedByOffice: z.string().max(100).optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      let holdDetails: {
        holdTypeId: string | null;
        holdType: string;
        holdCode: string;
        holdName: string;
        description: string | null;
        blocksRegistration: boolean;
        blocksGrades: boolean;
        blocksTranscript: boolean;
        blocksDiploma: boolean;
        releaseAuthority: string | null;
      };

      // If using a hold type, fetch its configuration
      if (input.holdTypeId) {
        const type = await ctx.db.query.holdTypes.findFirst({
          where: and(
            eq(holdTypes.id, input.holdTypeId),
            eq(holdTypes.institutionId, ctx.user!.institutionId),
            isNull(holdTypes.validTo) // Must be current version
          ),
        });

        if (!type) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Hold type not found or is not current version",
          });
        }

        holdDetails = {
          holdTypeId: type.id, // Link to hold type configuration
          holdType: type.category,
          holdCode: type.code,
          holdName: type.name,
          description: type.description,
          blocksRegistration: type.blocksRegistration ?? true,
          blocksGrades: type.blocksGrades ?? false,
          blocksTranscript: type.blocksTranscript ?? false,
          blocksDiploma: type.blocksDiploma ?? false,
          releaseAuthority: type.releaseAuthority,
        };
      } else {
        // Validate required fields for ad-hoc holds
        if (!input.holdType || !input.holdCode || !input.holdName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Must provide holdTypeId or holdType, holdCode, and holdName",
          });
        }

        holdDetails = {
          holdTypeId: null, // Ad-hoc hold without type configuration
          holdType: input.holdType,
          holdCode: input.holdCode,
          holdName: input.holdName,
          description: input.description ?? null,
          blocksRegistration: input.blocksRegistration ?? true,
          blocksGrades: input.blocksGrades ?? false,
          blocksTranscript: input.blocksTranscript ?? false,
          blocksDiploma: input.blocksDiploma ?? false,
          releaseAuthority: input.releaseAuthority ?? null,
        };
      }

      // Verify all students exist and belong to this institution
      const studentsData = await ctx.db.query.students.findMany({
        where: inArray(students.id, input.studentIds),
        columns: { id: true, institutionId: true },
      });

      const validStudentIds = studentsData
        .filter((s) => s.institutionId === ctx.user!.institutionId)
        .map((s) => s.id);

      if (validStudentIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid students found in the provided list",
        });
      }

      // Create holds for all valid students
      const holdsToCreate = validStudentIds.map((studentId) => ({
        studentId,
        holdTypeId: holdDetails.holdTypeId, // Link to hold type configuration
        holdType: holdDetails.holdType,
        holdCode: holdDetails.holdCode,
        holdName: holdDetails.holdName,
        description: holdDetails.description,
        blocksRegistration: holdDetails.blocksRegistration,
        blocksGrades: holdDetails.blocksGrades,
        blocksTranscript: holdDetails.blocksTranscript,
        blocksDiploma: holdDetails.blocksDiploma,
        releaseAuthority: holdDetails.releaseAuthority,
        effectiveFrom: new Date(),
        effectiveUntil: input.effectiveUntil ? new Date(input.effectiveUntil) : null,
        placedBy: ctx.user!.id,
        placedByOffice: input.placedByOffice ?? null,
      }));

      await ctx.db.insert(registrationHolds).values(holdsToCreate);

      // Send email notifications to all affected students
      try {
        const studentsWithEmails = await ctx.db.query.students.findMany({
          where: inArray(students.id, validStudentIds),
          with: {
            user: {
              columns: {
                email: true,
              },
            },
          },
        });

        // Build list of blocked actions (same for all students in this batch)
        const blockedActions: string[] = [];
        if (holdDetails.blocksRegistration) blockedActions.push("Course Registration");
        if (holdDetails.blocksGrades) blockedActions.push("Viewing Grades");
        if (holdDetails.blocksTranscript) blockedActions.push("Requesting Transcripts");
        if (holdDetails.blocksDiploma) blockedActions.push("Receiving Diploma");

        // Send notification to each student
        for (const student of studentsWithEmails) {
          if (student.user?.email) {
            const studentName = `${student.preferredFirstName ?? student.legalFirstName} ${student.preferredLastName ?? student.legalLastName}`;

            await sendHoldNotification({
              to: student.user.email,
              studentName,
              holdType: holdDetails.holdName,
              holdReason: holdDetails.description ?? "No additional information provided",
              blockedActions,
              contactOffice: holdDetails.releaseAuthority ?? "Registrar's Office",
              contactEmail: undefined,
              contactPhone: undefined,
            });
          }
        }

        console.log(`[Holds] Batch notification emails sent to ${studentsWithEmails.length} students`);
      } catch (emailError) {
        // Don't fail the batch operation if emails fail
        console.error("[Holds] Failed to send batch hold notification emails:", emailError);
      }

      return {
        created: validStudentIds.length,
        skipped: input.studentIds.length - validStudentIds.length,
        message: `Created ${validStudentIds.length} holds`,
      };
    }),

  /**
   * Release holds in batch
   */
  releaseBatch: protectedProcedure
    .input(
      z.object({
        holdIds: z.array(z.string().uuid()).min(1).max(500),
        resolutionNotes: z.string().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Get all holds and verify they belong to students in this institution
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: inArray(registrationHolds.id, input.holdIds),
        with: {
          student: {
            columns: { institutionId: true },
          },
        },
      });

      const validHoldIds = holds
        .filter(
          (h) =>
            h.student?.institutionId === ctx.user!.institutionId &&
            h.resolvedAt === null
        )
        .map((h) => h.id);

      if (validHoldIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid active holds found in the provided list",
        });
      }

      // Release all valid holds
      await ctx.db
        .update(registrationHolds)
        .set({
          resolvedAt: new Date(),
          resolvedBy: ctx.user!.id,
          resolutionNotes: input.resolutionNotes ?? null,
          updatedAt: new Date(),
        })
        .where(inArray(registrationHolds.id, validHoldIds));

      // Send email notifications to affected students
      try {
        // Get unique student IDs from the released holds
        const affectedStudentIds = Array.from(
          new Set(
            holds
              .filter((h) => validHoldIds.includes(h.id))
              .map((h) => h.studentId)
          )
        );

        const studentsWithEmails = await ctx.db.query.students.findMany({
          where: inArray(students.id, affectedStudentIds),
          with: {
            user: {
              columns: {
                email: true,
              },
            },
          },
        });

        // Send notification to each affected student
        for (const student of studentsWithEmails) {
          if (student.user?.email) {
            // Get all released holds for this student
            const studentReleasedHolds = holds.filter(
              (h) => h.studentId === student.id && validHoldIds.includes(h.id)
            );

            if (studentReleasedHolds.length > 0) {
              const holdNames = studentReleasedHolds.map((h) => h.holdName).join(", ");
              const studentName = `${student.preferredFirstName ?? student.legalFirstName} ${student.preferredLastName ?? student.legalLastName}`;

              // Build list of unblocked actions
              const unblockedActions = new Set<string>();
              for (const hold of studentReleasedHolds) {
                if (hold.blocksRegistration) unblockedActions.add("Course Registration");
                if (hold.blocksGrades) unblockedActions.add("Viewing Grades");
                if (hold.blocksTranscript) unblockedActions.add("Requesting Transcripts");
                if (hold.blocksDiploma) unblockedActions.add("Receiving Diploma");
              }

              await sendHoldNotification({
                to: student.user.email,
                studentName,
                holdType: studentReleasedHolds.length > 1
                  ? `${studentReleasedHolds.length} Holds - CLEARED`
                  : `${studentReleasedHolds[0]?.holdName} - CLEARED`,
                holdReason: input.resolutionNotes
                  ? `These holds have been cleared. Resolution: ${input.resolutionNotes}`
                  : `The following hold(s) have been cleared: ${holdNames}`,
                blockedActions: unblockedActions.size > 0
                  ? [`You can now: ${Array.from(unblockedActions).join(", ")}`]
                  : ["No restrictions were in place"],
                contactOffice: "Registrar's Office",
                contactEmail: undefined,
                contactPhone: undefined,
              });
            }
          }
        }

        console.log(`[Holds] Batch clearance notification emails sent to ${studentsWithEmails.length} students`);
      } catch (emailError) {
        // Don't fail the batch operation if emails fail
        console.error("[Holds] Failed to send batch clearance notification emails:", emailError);
      }

      return {
        released: validHoldIds.length,
        skipped: input.holdIds.length - validHoldIds.length,
        message: `Released ${validHoldIds.length} holds`,
      };
    }),

  /**
   * Release all holds of a specific type for a student
   */
  releaseByType: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        holdCode: z.string().optional(),
        holdType: z.enum(["academic", "financial", "administrative", "disciplinary"]).optional(),
        resolutionNotes: z.string().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Verify student belongs to institution
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
        columns: { institutionId: true },
      });

      if (!student || student.institutionId !== ctx.user!.institutionId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      const filters = [
        eq(registrationHolds.studentId, input.studentId),
        isNull(registrationHolds.resolvedAt),
      ];

      if (input.holdCode) {
        filters.push(eq(registrationHolds.holdCode, input.holdCode));
      }

      if (input.holdType) {
        filters.push(eq(registrationHolds.holdType, input.holdType));
      }

      const result = await ctx.db
        .update(registrationHolds)
        .set({
          resolvedAt: new Date(),
          resolvedBy: ctx.user!.id,
          resolutionNotes: input.resolutionNotes ?? null,
          updatedAt: new Date(),
        })
        .where(and(...filters))
        .returning({ id: registrationHolds.id });

      return {
        released: result.length,
        message: `Released ${result.length} holds`,
      };
    }),

  /**
   * Check if a student has any blocking holds
   */
  checkBlocking: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        checkType: z.enum(["registration", "grades", "transcript", "diploma"]).default("registration"),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR", "STUDENT"))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(registrationHolds.studentId, input.studentId),
        isNull(registrationHolds.resolvedAt),
      ];

      // Add time-based filter (hold must be currently effective)
      const now = new Date();

      const holds = await ctx.db.query.registrationHolds.findMany({
        where: and(...filters),
      });

      // Filter by what's blocked and check effective dates
      const blockingHolds = holds.filter((h) => {
        // Check if currently effective
        const effectiveFrom = h.effectiveFrom ?? new Date(0);
        const isEffective =
          effectiveFrom <= now &&
          (h.effectiveUntil === null || h.effectiveUntil > now);

        if (!isEffective) return false;

        // Check the specific block type
        switch (input.checkType) {
          case "registration":
            return h.blocksRegistration;
          case "grades":
            return h.blocksGrades;
          case "transcript":
            return h.blocksTranscript;
          case "diploma":
            return h.blocksDiploma;
          default:
            return false;
        }
      });

      return {
        isBlocked: blockingHolds.length > 0,
        holdCount: blockingHolds.length,
        holds: blockingHolds.map((h) => ({
          id: h.id,
          holdCode: h.holdCode,
          holdName: h.holdName,
          description: h.description,
          releaseAuthority: h.releaseAuthority,
        })),
      };
    }),

  /**
   * Get hold statistics for reporting
   */
  getStats: protectedProcedure
    .input(
      z.object({
        holdType: z.enum(["academic", "financial", "administrative", "disciplinary"]).optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      // Get all active holds for institution
      const allHolds = await ctx.db.query.registrationHolds.findMany({
        where: isNull(registrationHolds.resolvedAt),
        with: {
          student: {
            columns: { institutionId: true },
          },
        },
      });

      // Filter to this institution
      let filteredHolds = allHolds.filter(
        (h) => h.student?.institutionId === ctx.user!.institutionId
      );

      if (input.holdType) {
        filteredHolds = filteredHolds.filter((h) => h.holdType === input.holdType);
      }

      // Calculate statistics
      const byType = filteredHolds.reduce(
        (acc, h) => {
          acc[h.holdType] = (acc[h.holdType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const byCode = filteredHolds.reduce(
        (acc, h) => {
          acc[h.holdCode] = (acc[h.holdCode] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const blockingRegistration = filteredHolds.filter(
        (h) => h.blocksRegistration
      ).length;

      const uniqueStudents = new Set(filteredHolds.map((h) => h.studentId)).size;

      return {
        totalActiveHolds: filteredHolds.length,
        uniqueStudentsWithHolds: uniqueStudents,
        blockingRegistration,
        byType,
        byCode,
      };
    }),
});
