/**
 * Grade Change Router
 *
 * Handles grade change request operations including:
 * - Creating grade change/correction requests
 * - Processing incomplete grade conversions
 * - Reviewing and approving/denying requests
 * - Applying approved grade changes
 *
 * All operations maintain a full audit trail for compliance.
 */

import { z } from "zod";
import { eq, and, desc, inArray, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  requireRole,
} from "../trpc.js";
import {
  gradeChangeRequests,
  registrations,
  students,
  sections,
  courses,
  grades,
  users,
} from "@sis/db/schema";

// ============================================================================
// Input Schemas
// ============================================================================

const changeTypeSchema = z.enum([
  "correction",           // Simple grade correction (typo, etc.)
  "incomplete_conversion", // Converting I grade to letter grade
  "appeal",               // Grade appeal decision
  "administrative",       // Administrative correction
]);

const statusSchema = z.enum(["pending", "approved", "denied", "applied"]);

const listRequestsSchema = z.object({
  status: statusSchema.optional(),
  changeType: changeTypeSchema.optional(),
  studentId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  requestedBy: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const createRequestSchema = z.object({
  registrationId: z.string().uuid(),
  requestedGradeCode: z.string().min(1).max(5),
  changeType: changeTypeSchema,
  reason: z.string().min(10).max(2000),
  documentationUrl: z.string().url().optional(),
  documentationNotes: z.string().max(1000).optional(),
  // For incomplete conversions
  incompleteDeadline: z.string().date().optional(),
  incompleteDefaultGrade: z.string().max(5).optional(),
});

const reviewRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "deny"]),
  reviewNotes: z.string().max(1000).optional(),
  denialReason: z.string().max(1000).optional(),
});

const applyChangeSchema = z.object({
  requestId: z.string().uuid(),
});

const getRequestSchema = z.object({
  requestId: z.string().uuid(),
});

const getHistorySchema = z.object({
  registrationId: z.string().uuid(),
});

// ============================================================================
// Router
// ============================================================================

export const gradeChangeRouter = router({
  /**
   * List grade change requests with filtering
   * Accessible by registrar, faculty, and admin roles
   */
  list: protectedProcedure
    .input(listRequestsSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(gradeChangeRequests.status, input.status));
      }

      if (input.changeType) {
        conditions.push(eq(gradeChangeRequests.changeType, input.changeType));
      }

      if (input.requestedBy) {
        conditions.push(eq(gradeChangeRequests.requestedBy, input.requestedBy));
      }

      // For student/section filtering, we need to join through registration
      let registrationIds: string[] | null = null;

      if (input.studentId || input.sectionId) {
        const regConditions = [];
        if (input.studentId) {
          regConditions.push(eq(registrations.studentId, input.studentId));
        }
        if (input.sectionId) {
          regConditions.push(eq(registrations.sectionId, input.sectionId));
        }

        const regs = await ctx.db.query.registrations.findMany({
          where: and(...regConditions),
          columns: { id: true },
        });
        registrationIds = regs.map((r) => r.id);

        if (registrationIds.length === 0) {
          return { requests: [], total: 0, hasMore: false };
        }

        conditions.push(inArray(gradeChangeRequests.registrationId, registrationIds));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const requests = await ctx.db.query.gradeChangeRequests.findMany({
        where: whereClause,
        with: {
          registration: {
            with: {
              student: true,
              section: {
                with: {
                  course: true,
                },
              },
            },
          },
          requester: true,
          reviewer: true,
        },
        orderBy: [desc(gradeChangeRequests.requestedAt)],
        limit: input.limit,
        offset: input.offset,
      });

      // Get total count
      const allRequests = await ctx.db.query.gradeChangeRequests.findMany({
        where: whereClause,
        columns: { id: true },
      });

      return {
        requests: requests.map((req) => ({
          id: req.id,
          registrationId: req.registrationId,
          student: req.registration?.student
            ? {
                id: req.registration.student.id,
                name: `${req.registration.student.preferredFirstName ?? req.registration.student.legalFirstName} ${req.registration.student.legalLastName}`,
                studentId: req.registration.student.studentId,
              }
            : null,
          course: req.registration?.section?.course
            ? {
                courseCode: req.registration.section.course.courseCode,
                title: req.registration.section.course.title,
              }
            : null,
          section: req.registration?.section
            ? {
                id: req.registration.section.id,
                sectionNumber: req.registration.section.sectionNumber,
              }
            : null,
          originalGradeCode: req.originalGradeCode,
          requestedGradeCode: req.requestedGradeCode,
          changeType: req.changeType,
          status: req.status,
          reason: req.reason,
          requestedBy: req.requester
            ? { id: req.requester.id, name: req.requester.displayName }
            : null,
          requestedAt: req.requestedAt,
          reviewedBy: req.reviewer
            ? { id: req.reviewer.id, name: req.reviewer.displayName }
            : null,
          reviewedAt: req.reviewedAt,
        })),
        total: allRequests.length,
        hasMore: input.offset + input.limit < allRequests.length,
      };
    }),

  /**
   * Get a single grade change request by ID
   */
  getById: protectedProcedure
    .input(getRequestSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.query.gradeChangeRequests.findFirst({
        where: eq(gradeChangeRequests.id, input.requestId),
        with: {
          registration: {
            with: {
              student: true,
              section: {
                with: {
                  course: true,
                },
              },
              term: true,
            },
          },
          requester: true,
          reviewer: true,
          applier: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grade change request not found",
        });
      }

      return {
        id: request.id,
        registrationId: request.registrationId,
        student: request.registration?.student
          ? {
              id: request.registration.student.id,
              firstName: request.registration.student.preferredFirstName ?? request.registration.student.legalFirstName,
              lastName: request.registration.student.legalLastName,
              studentId: request.registration.student.studentId,
              email: request.registration.student.primaryEmail,
            }
          : null,
        course: request.registration?.section?.course
          ? {
              id: request.registration.section.course.id,
              courseCode: request.registration.section.course.courseCode,
              title: request.registration.section.course.title,
            }
          : null,
        section: request.registration?.section
          ? {
              id: request.registration.section.id,
              sectionNumber: request.registration.section.sectionNumber,
            }
          : null,
        term: request.registration?.term
          ? {
              id: request.registration.term.id,
              name: request.registration.term.name,
            }
          : null,
        originalGradeCode: request.originalGradeCode,
        originalGradePoints: request.originalGradePoints,
        requestedGradeCode: request.requestedGradeCode,
        requestedGradePoints: request.requestedGradePoints,
        changeType: request.changeType,
        reason: request.reason,
        documentationUrl: request.documentationUrl,
        documentationNotes: request.documentationNotes,
        status: request.status,
        // Incomplete-specific fields
        incompleteDeadline: request.incompleteDeadline,
        incompleteDefaultGrade: request.incompleteDefaultGrade,
        // Request info
        requestedBy: request.requester
          ? { id: request.requester.id, name: request.requester.displayName, email: request.requester.email }
          : null,
        requestedAt: request.requestedAt,
        // Review info
        reviewedBy: request.reviewer
          ? { id: request.reviewer.id, name: request.reviewer.displayName }
          : null,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
        denialReason: request.denialReason,
        // Application info
        appliedBy: request.applier
          ? { id: request.applier.id, name: request.applier.displayName }
          : null,
        appliedAt: request.appliedAt,
        // Timestamps
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    }),

  /**
   * Get grade change history for a specific registration
   */
  getHistory: protectedProcedure
    .input(getHistorySchema)
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.query.gradeChangeRequests.findMany({
        where: eq(gradeChangeRequests.registrationId, input.registrationId),
        with: {
          requester: true,
          reviewer: true,
          applier: true,
        },
        orderBy: [desc(gradeChangeRequests.requestedAt)],
      });

      return history.map((req) => ({
        id: req.id,
        originalGradeCode: req.originalGradeCode,
        requestedGradeCode: req.requestedGradeCode,
        changeType: req.changeType,
        status: req.status,
        reason: req.reason,
        requestedBy: req.requester?.displayName ?? null,
        requestedAt: req.requestedAt,
        reviewedBy: req.reviewer?.displayName ?? null,
        reviewedAt: req.reviewedAt,
        reviewNotes: req.reviewNotes,
        denialReason: req.denialReason,
        appliedBy: req.applier?.displayName ?? null,
        appliedAt: req.appliedAt,
      }));
    }),

  /**
   * Create a new grade change request
   * Accessible by faculty and registrar
   */
  create: protectedProcedure
    .input(createRequestSchema)
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .mutation(async ({ ctx, input }) => {
      // Get the registration
      const registration = await ctx.db.query.registrations.findFirst({
        where: eq(registrations.id, input.registrationId),
        with: {
          section: {
            with: {
              course: true,
            },
          },
        },
      });

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registration not found",
        });
      }

      // Validate the requested grade exists
      const gradeList = await ctx.db.query.grades.findMany({});
      const validGradeCodes = new Set(gradeList.map((g) => g.gradeCode));

      if (!validGradeCodes.has(input.requestedGradeCode)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid grade code: ${input.requestedGradeCode}`,
        });
      }

      // Get grade points for the requested grade
      const requestedGrade = gradeList.find((g) => g.gradeCode === input.requestedGradeCode);
      const requestedGradePoints = requestedGrade?.gradePoints ?? null;

      // Check for pending requests on this registration
      const pendingRequest = await ctx.db.query.gradeChangeRequests.findFirst({
        where: and(
          eq(gradeChangeRequests.registrationId, input.registrationId),
          eq(gradeChangeRequests.status, "pending")
        ),
      });

      if (pendingRequest) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A pending grade change request already exists for this registration",
        });
      }

      // Validate incomplete conversion fields
      if (input.changeType === "incomplete_conversion") {
        if (registration.gradeCode !== "I") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Incomplete conversion is only valid for registrations with an 'I' grade",
          });
        }
      }

      const [newRequest] = await ctx.db
        .insert(gradeChangeRequests)
        .values({
          registrationId: input.registrationId,
          originalGradeCode: registration.gradeCode,
          originalGradePoints: registration.gradePoints,
          requestedGradeCode: input.requestedGradeCode,
          requestedGradePoints: requestedGradePoints,
          changeType: input.changeType,
          reason: input.reason,
          documentationUrl: input.documentationUrl,
          documentationNotes: input.documentationNotes,
          incompleteDeadline: input.incompleteDeadline,
          incompleteDefaultGrade: input.incompleteDefaultGrade,
          status: "pending",
          requestedBy: ctx.user.id,
        })
        .returning();

      return {
        requestId: newRequest?.id,
        status: "pending",
        message: "Grade change request created successfully",
      };
    }),

  /**
   * Review a grade change request (approve or deny)
   * Accessible by registrar and admin only
   */
  review: protectedProcedure
    .input(reviewRequestSchema)
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.query.gradeChangeRequests.findFirst({
        where: eq(gradeChangeRequests.id, input.requestId),
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grade change request not found",
        });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot review request with status: ${request.status}`,
        });
      }

      if (input.action === "deny" && !input.denialReason) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Denial reason is required when denying a request",
        });
      }

      const now = new Date();
      const newStatus = input.action === "approve" ? "approved" : "denied";

      await ctx.db
        .update(gradeChangeRequests)
        .set({
          status: newStatus,
          reviewedBy: ctx.user.id,
          reviewedAt: now,
          reviewNotes: input.reviewNotes,
          denialReason: input.action === "deny" ? input.denialReason : null,
          updatedAt: now,
        })
        .where(eq(gradeChangeRequests.id, input.requestId));

      return {
        requestId: input.requestId,
        status: newStatus,
        message: `Grade change request ${input.action === "approve" ? "approved" : "denied"}`,
      };
    }),

  /**
   * Apply an approved grade change to the registration
   * This actually updates the grade on the registration record
   */
  applyGradeChange: protectedProcedure
    .input(applyChangeSchema)
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.query.gradeChangeRequests.findFirst({
        where: eq(gradeChangeRequests.id, input.requestId),
        with: {
          registration: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Grade change request not found",
        });
      }

      if (request.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot apply request with status: ${request.status}. Must be 'approved' first.`,
        });
      }

      if (!request.registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Associated registration not found",
        });
      }

      const now = new Date();

      // Update the registration with the new grade
      await ctx.db
        .update(registrations)
        .set({
          gradeCode: request.requestedGradeCode,
          gradePoints: request.requestedGradePoints,
          updatedAt: now,
        })
        .where(eq(registrations.id, request.registrationId));

      // Mark the request as applied
      await ctx.db
        .update(gradeChangeRequests)
        .set({
          status: "applied",
          appliedBy: ctx.user.id,
          appliedAt: now,
          updatedAt: now,
        })
        .where(eq(gradeChangeRequests.id, input.requestId));

      return {
        requestId: input.requestId,
        registrationId: request.registrationId,
        status: "applied",
        newGradeCode: request.requestedGradeCode,
        message: "Grade change applied successfully",
      };
    }),

  /**
   * Get pending requests count for dashboard
   */
  getPendingCount: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "FACULTY"))
    .query(async ({ ctx }) => {
      const pendingRequests = await ctx.db.query.gradeChangeRequests.findMany({
        where: eq(gradeChangeRequests.status, "pending"),
        columns: { id: true },
      });

      return {
        count: pendingRequests.length,
      };
    }),

  /**
   * Get grade change statistics
   */
  getStats: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx }) => {
      const allRequests = await ctx.db.query.gradeChangeRequests.findMany({
        columns: {
          id: true,
          status: true,
          changeType: true,
        },
      });

      const byStatus = {
        pending: 0,
        approved: 0,
        denied: 0,
        applied: 0,
      };

      const byType = {
        correction: 0,
        incomplete_conversion: 0,
        appeal: 0,
        administrative: 0,
      };

      for (const req of allRequests) {
        if (req.status && req.status in byStatus) {
          byStatus[req.status as keyof typeof byStatus]++;
        }
        if (req.changeType && req.changeType in byType) {
          byType[req.changeType as keyof typeof byType]++;
        }
      }

      return {
        total: allRequests.length,
        byStatus,
        byType,
      };
    }),
});
