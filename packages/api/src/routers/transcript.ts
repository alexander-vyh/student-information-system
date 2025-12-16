/**
 * Transcript Router
 *
 * tRPC router for transcript generation, request management, and hold checking.
 * Implements FERPA-compliant access logging and hold blocking.
 */

import { z } from "zod";
import { router, protectedProcedure, requireRole, canAccessStudent } from "../trpc.js";
import { eq, and, desc, isNull, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  students,
  studentPrograms,
  studentGpaSummary,
  studentMajors,
  registrations,
  sections,
  courses,
  subjects,
  terms,
  grades,
  transferCredits,
  testScores,
  registrationHolds,
  holdTypes,
  termEnrollments,
  transcriptRequests,
  studentNameHistory,
  type TranscriptType,
  type TranscriptDeliveryMethod,
  type TranscriptRequestStatus,
} from "@sis/db/schema";

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const transcriptRequestInput = z.object({
  studentId: z.string().uuid(),
  transcriptType: z.enum(["official", "unofficial", "verification_only"]),
  deliveryMethod: z.enum(["electronic_pdf", "electronic_exchange", "mail", "pickup", "third_party"]),
  recipientName: z.string().max(200).optional(),
  recipientEmail: z.string().email().optional(),
  recipientAddress: z.object({
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }).optional(),
  recipientType: z.enum(["self", "employer", "grad_school", "other_institution", "licensing_board"]).optional(),
  purpose: z.enum(["employment", "grad_school", "licensing", "personal"]).optional(),
  copiesRequested: z.number().int().min(1).max(10).default(1),
  holdForDegree: z.boolean().default(false),
  rushProcessing: z.boolean().default(false),
});

const transcriptFilterInput = z.object({
  studentId: z.string().uuid().optional(),
  status: z.enum(["pending", "processing", "hold_blocked", "completed", "cancelled", "failed"]).optional(),
  transcriptType: z.enum(["official", "unofficial", "verification_only"]).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// =============================================================================
// ROUTER
// =============================================================================

export const transcriptRouter = router({
  // ============================================================================
  // TRANSCRIPT REQUESTS
  // ============================================================================

  /**
   * Request a transcript (student or staff initiated)
   */
  requestTranscript: protectedProcedure
    .input(transcriptRequestInput)
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Verify student exists
      const student = await ctx.db.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Check for blocking holds (for official transcripts)
      if (input.transcriptType === "official") {
        const blockingHolds = await ctx.db.query.registrationHolds.findMany({
          where: and(
            eq(registrationHolds.studentId, input.studentId),
            eq(registrationHolds.blocksTranscript, true),
            isNull(registrationHolds.resolvedAt)
          ),
          with: {
            holdTypeConfig: true,
          },
        });

        if (blockingHolds.length > 0) {
          // Create request in hold_blocked status
          const blockedRequestResults = await ctx.db
            .insert(transcriptRequests)
            .values({
              studentId: input.studentId,
              institutionId: ctx.user!.institutionId,
              transcriptType: input.transcriptType,
              deliveryMethod: input.deliveryMethod,
              recipientName: input.recipientName ?? null,
              recipientEmail: input.recipientEmail ?? null,
              recipientAddress: input.recipientAddress ?? null,
              recipientType: input.recipientType ?? null,
              purpose: input.purpose ?? null,
              copiesRequested: input.copiesRequested,
              holdForDegree: input.holdForDegree,
              status: "hold_blocked" as TranscriptRequestStatus,
              blockingHoldIds: blockingHolds.map((h) => h.id),
              requestedBy: ctx.user!.id,
            })
            .returning();

          const blockedRequest = blockedRequestResults[0];
          if (!blockedRequest) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create transcript request",
            });
          }

          // Log the blocked request
          console.log(
            JSON.stringify({
              type: "AUDIT_LOG",
              category: "transcript",
              action: "create",
              outcome: "blocked",
              actorId: ctx.user!.id,
              studentId: input.studentId,
              transcriptRequestId: blockedRequest.id,
              blockingHoldCount: blockingHolds.length,
              timestamp: new Date().toISOString(),
            })
          );

          return {
            request: blockedRequest,
            blocked: true,
            blockingHolds: blockingHolds.map((h) => ({
              holdId: h.id,
              holdCode: h.holdCode,
              holdName: h.holdName,
              releaseAuthority: h.releaseAuthority,
              resolutionInstructions: h.holdTypeConfig?.resolutionInstructions,
            })),
          };
        }
      }

      // Create the request
      const requestResults = await ctx.db
        .insert(transcriptRequests)
        .values({
          studentId: input.studentId,
          institutionId: ctx.user!.institutionId,
          transcriptType: input.transcriptType,
          deliveryMethod: input.deliveryMethod,
          recipientName: input.recipientName ?? null,
          recipientEmail: input.recipientEmail ?? null,
          recipientAddress: input.recipientAddress ?? null,
          recipientType: input.recipientType ?? null,
          purpose: input.purpose ?? null,
          copiesRequested: input.copiesRequested,
          holdForDegree: input.holdForDegree,
          status: "pending" as TranscriptRequestStatus,
          requestedBy: ctx.user!.id,
        })
        .returning();

      const request = requestResults[0];
      if (!request) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create transcript request",
        });
      }

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "transcript",
          action: "create",
          outcome: "success",
          actorId: ctx.user!.id,
          studentId: input.studentId,
          transcriptRequestId: request.id,
          transcriptType: input.transcriptType,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        request,
        blocked: false,
        blockingHolds: [],
      };
    }),

  /**
   * Get transcript request by ID
   */
  getRequest: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.query.transcriptRequests.findFirst({
        where: and(
          eq(transcriptRequests.id, input.requestId),
          eq(transcriptRequests.institutionId, ctx.user!.institutionId)
        ),
        with: {
          student: true,
          requestedByUser: true,
          processedByUser: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transcript request not found",
        });
      }

      // Check access - must be student or staff
      const isStaff = ["ADMIN", "REGISTRAR"].some((r) => ctx.user!.roles.includes(r));
      const isOwnRequest = ctx.user!.studentId === request.studentId;

      if (!isStaff && !isOwnRequest) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view this request",
        });
      }

      return request;
    }),

  /**
   * List transcript requests (with filters)
   */
  listRequests: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(transcriptFilterInput)
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transcriptRequests.institutionId, ctx.user!.institutionId)];

      if (input.studentId) {
        conditions.push(eq(transcriptRequests.studentId, input.studentId));
      }
      if (input.status) {
        conditions.push(eq(transcriptRequests.status, input.status));
      }
      if (input.transcriptType) {
        conditions.push(eq(transcriptRequests.transcriptType, input.transcriptType));
      }
      if (input.dateFrom) {
        conditions.push(gte(transcriptRequests.requestedAt, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(transcriptRequests.requestedAt, input.dateTo));
      }

      const requests = await ctx.db.query.transcriptRequests.findMany({
        where: and(...conditions),
        with: {
          student: true,
        },
        orderBy: [desc(transcriptRequests.requestedAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return requests;
    }),

  /**
   * Get student's own transcript requests
   */
  getMyRequests: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user!.studentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not a student",
        });
      }

      const requests = await ctx.db.query.transcriptRequests.findMany({
        where: eq(transcriptRequests.studentId, ctx.user!.studentId),
        orderBy: [desc(transcriptRequests.requestedAt)],
      });

      return requests;
    }),

  /**
   * Update transcript request status (registrar)
   */
  updateRequestStatus: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      requestId: z.string().uuid(),
      status: z.enum(["processing", "completed", "cancelled", "failed"]),
      trackingNumber: z.string().optional(),
      documentStorageKey: z.string().optional(),
      documentHash: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(transcriptRequests)
        .set({
          status: input.status as TranscriptRequestStatus,
          processedBy: ctx.user!.id,
          processedAt: new Date(),
          trackingNumber: input.trackingNumber,
          documentStorageKey: input.documentStorageKey,
          documentHash: input.documentHash,
          deliveredAt: input.status === "completed" ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transcriptRequests.id, input.requestId),
            eq(transcriptRequests.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transcript request not found",
        });
      }

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "transcript",
          action: "update",
          outcome: "success",
          actorId: ctx.user!.id,
          transcriptRequestId: input.requestId,
          newStatus: input.status,
          timestamp: new Date().toISOString(),
        })
      );

      return updated;
    }),

  // ============================================================================
  // TRANSCRIPT DATA RETRIEVAL
  // ============================================================================

  /**
   * Get complete transcript data for a student
   * Used for PDF generation or display
   */
  getTranscriptData: protectedProcedure
    .input(z.object({
      studentId: z.string().uuid(),
      includeInProgress: z.boolean().default(false),
    }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Fetch student
      const student = await ctx.db.query.students.findFirst({
        where: and(
          eq(students.id, input.studentId),
          eq(students.institutionId, ctx.user!.institutionId)
        ),
        with: {
          programs: {
            with: {
              majors: true,
            },
          },
          gpaSummary: true,
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      // Fetch name history
      const nameHistory = await ctx.db.query.studentNameHistory.findMany({
        where: eq(studentNameHistory.studentId, input.studentId),
        orderBy: [desc(studentNameHistory.effectiveFrom)],
      });

      // Fetch registrations with all related data
      const registrationData = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          input.includeInProgress
            ? undefined
            : eq(registrations.status, "completed")
        ),
        with: {
          section: {
            with: {
              course: {
                with: {
                  subject: true,
                },
              },
            },
          },
          term: true,
          grade: true,
        },
        orderBy: [desc(registrations.registrationDate)],
      });

      // Fetch term enrollments for honors/dean's list
      const termData = await ctx.db.query.termEnrollments.findMany({
        where: eq(termEnrollments.studentId, input.studentId),
        with: {
          term: true,
        },
        orderBy: [desc(termEnrollments.termId)],
      });

      // Fetch transfer credits
      const transfers = await ctx.db.query.transferCredits.findMany({
        where: eq(transferCredits.studentId, input.studentId),
        with: {
          equivalentCourse: true,
        },
      });

      // Fetch test scores (AP, CLEP, etc.)
      const tests = await ctx.db.query.testScores.findMany({
        where: and(
          eq(testScores.studentId, input.studentId),
          gte(testScores.creditAwarded, "0.01") // Only scores that awarded credit
        ),
        with: {
          equivalentCourse: true,
        },
      });

      // Group registrations by term
      const termMap = new Map<string, typeof registrationData>();
      for (const reg of registrationData) {
        const termId = reg.termId;
        if (!termMap.has(termId)) {
          termMap.set(termId, []);
        }
        termMap.get(termId)!.push(reg);
      }

      // Build term records with GPA
      const termRecords = Array.from(termMap.entries()).map(([termId, regs]) => {
        const termEnrollment = termData.find((t) => t.termId === termId);
        const term = regs[0]?.term;

        return {
          termId,
          termCode: term?.code ?? "",
          termName: term?.name ?? "",
          startDate: term?.startDate,
          endDate: term?.endDate,
          courses: regs.map((reg) => ({
            courseCode: `${reg.section?.course?.subject?.code ?? ""} ${reg.section?.course?.courseNumber ?? ""}`,
            courseTitle: reg.section?.course?.title ?? "",
            creditHours: reg.creditHours,
            creditsEarned: reg.creditsEarned,
            gradeCode: reg.gradeCode,
            gradePoints: reg.gradePoints,
            isRepeat: reg.isRepeat,
            repeatAction: reg.repeatAction,
            includeInGpa: reg.includeInGpa,
          })),
          termGpa: termEnrollment?.termGpa ?? null,
          termCreditsAttempted: termEnrollment?.attemptedCredits ?? null,
          termCreditsEarned: termEnrollment?.earnedCredits ?? null,
          honors: termEnrollment?.honors ?? [],
        };
      });

      // Sort terms chronologically
      termRecords.sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });

      // Audit log - transcript data accessed
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "transcript",
          action: "view",
          outcome: "success",
          actorId: ctx.user!.id,
          studentId: input.studentId,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        student: {
          id: student.id,
          studentId: student.studentId,
          legalFirstName: student.legalFirstName,
          legalMiddleName: student.legalMiddleName,
          legalLastName: student.legalLastName,
          suffix: student.suffix,
          dateOfBirth: student.dateOfBirth,
          previousNames: nameHistory.filter((n) => n.nameType === "previous_legal"),
        },
        programs: student.programs.map((p) => ({
          id: p.id,
          programId: p.programId,
          status: p.status,
          degreeAwardedDate: p.degreeAwardedDate,
          diplomaName: p.diplomaName,
          honorsDesignation: p.honorsDesignation,
          majors: p.majors,
        })),
        cumulativeRecord: {
          attemptedCredits: student.gpaSummary[0]?.cumulativeAttemptedCredits ?? 0,
          earnedCredits: student.gpaSummary[0]?.cumulativeEarnedCredits ?? 0,
          qualityPoints: student.gpaSummary[0]?.cumulativeQualityPoints ?? 0,
          gpa: student.gpaSummary[0]?.cumulativeGpa ?? null,
          transferCredits: student.gpaSummary[0]?.transferCredits ?? 0,
        },
        termRecords,
        transferCredits: transfers.map((t) => ({
          sourceInstitutionName: t.sourceInstitutionName,
          sourceCourseCode: t.sourceCourseCode,
          sourceCourseTitle: t.sourceCourseTitle,
          sourceCredits: t.sourceCredits,
          transferCredits: t.transferCredits,
          equivalentCourseCode: t.equivalentCourse
            ? `${t.equivalentCourse.courseCode}`
            : null,
          includeInGpa: t.includeInGpa,
        })),
        testCredits: tests.map((t) => ({
          testCode: t.testCode,
          testName: t.testName,
          score: t.score,
          creditAwarded: t.creditAwarded,
          equivalentCourseCode: t.equivalentCourse?.courseCode ?? null,
        })),
        generatedAt: new Date(),
      };
    }),

  // ============================================================================
  // HOLD CHECKING
  // ============================================================================

  /**
   * Check if student has holds blocking transcript
   */
  checkTranscriptHolds: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const holds = await ctx.db.query.registrationHolds.findMany({
        where: and(
          eq(registrationHolds.studentId, input.studentId),
          eq(registrationHolds.blocksTranscript, true),
          isNull(registrationHolds.resolvedAt)
        ),
        with: {
          holdTypeConfig: true,
        },
      });

      return {
        hasBlockingHolds: holds.length > 0,
        holds: holds.map((h) => ({
          holdId: h.id,
          holdCode: h.holdCode,
          holdName: h.holdName,
          category: h.holdType,
          placedDate: h.effectiveFrom,
          releaseAuthority: h.releaseAuthority,
          resolutionInstructions: h.holdTypeConfig?.resolutionInstructions,
        })),
      };
    }),

  // ============================================================================
  // NAME HISTORY
  // ============================================================================

  /**
   * Get student name history
   */
  getNameHistory: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.query.studentNameHistory.findMany({
        where: eq(studentNameHistory.studentId, input.studentId),
        orderBy: [desc(studentNameHistory.effectiveFrom)],
        with: {
          changedByUser: true,
        },
      });

      return history;
    }),

  /**
   * Add name history entry (for name changes)
   */
  addNameHistory: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      studentId: z.string().uuid(),
      nameType: z.enum(["legal", "preferred", "previous_legal"]),
      firstName: z.string().min(1).max(100),
      middleName: z.string().max(100).optional(),
      lastName: z.string().min(1).max(100),
      suffix: z.string().max(20).optional(),
      effectiveFrom: z.date(),
      effectiveUntil: z.date().optional(),
      changeReason: z.enum(["marriage", "court_order", "correction", "preferred_name_update"]).optional(),
      documentationOnFile: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const nameHistoryValues: typeof studentNameHistory.$inferInsert = {
        studentId: input.studentId,
        nameType: input.nameType,
        firstName: input.firstName,
        middleName: input.middleName ?? null,
        lastName: input.lastName,
        suffix: input.suffix ?? null,
        effectiveFrom: input.effectiveFrom.toISOString().split("T")[0]!,
        effectiveUntil: input.effectiveUntil?.toISOString().split("T")[0] ?? null,
        changeReason: input.changeReason ?? null,
        documentationOnFile: input.documentationOnFile,
        changedBy: ctx.user!.id,
      };

      const entryResults = await ctx.db
        .insert(studentNameHistory)
        .values(nameHistoryValues)
        .returning();

      const entry = entryResults[0];
      if (!entry) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create name history entry",
        });
      }

      return entry;
    }),

  // ============================================================================
  // UNOFFICIAL TRANSCRIPT (SELF-SERVICE)
  // ============================================================================

  /**
   * Generate unofficial transcript for current user
   */
  getMyUnofficialTranscript: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user!.studentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not a student",
        });
      }

      // Get student info
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, ctx.user!.studentId),
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student record not found",
        });
      }

      // Audit log - self-service transcript access
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "transcript",
          action: "view",
          outcome: "success",
          actorId: ctx.user!.id,
          studentId: ctx.user!.studentId,
          selfAccess: true,
          transcriptType: "unofficial",
          timestamp: new Date().toISOString(),
        })
      );

      // Reuse getTranscriptData logic by building the input
      // This would typically call an internal function, but for simplicity,
      // we'll return a redirect to use the full data endpoint
      return {
        studentId: ctx.user!.studentId,
        message: "Use getTranscriptData with this studentId for full data",
      };
    }),
});
