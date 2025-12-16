/**
 * Graduation Router
 *
 * tRPC router for graduation applications, conferral workflow, and
 * commencement ceremony management.
 */

import { z } from "zod";
import { router, protectedProcedure, requireRole, canAccessStudent } from "../trpc.js";
import { eq, and, desc, isNull, inArray, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  students,
  studentPrograms,
  studentGpaSummary,
  terms,
  registrationHolds,
  graduationApplications,
  commencementCeremonies,
  ceremonyParticipants,
  batchConferralJobs,
  studentDegreeAudits,
  registrations,
  type GraduationApplicationStatus,
  type LatinHonorsDesignation,
  type BatchConferralConfig,
  type BatchConferralResultEntry,
} from "@sis/db/schema";
import {
  validateGraduationEligibility,
  calculateLatinHonors,
  formatLatinHonors,
  canConfer,
  processBatchConferral,
  DEFAULT_GRADUATION_POLICY,
  type GraduationEligibilityInput,
  type BlockingHold,
  type LatinHonorsConfig,
} from "@sis/domain";

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const graduationApplicationInput = z.object({
  studentProgramId: z.string().uuid(),
  requestedConferralTermId: z.string().uuid(),
  requestedConferralDate: z.date().optional(),
  ceremonyPreference: z.enum(["main_ceremony", "departmental", "none"]).optional(),
  diplomaNameRequested: z.string().max(200).optional(),
  diplomaMailingAddress: z.object({
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string().default("US"),
  }).optional(),
});

const clearanceUpdateInput = z.object({
  applicationId: z.string().uuid(),
  clearanceType: z.enum(["financial", "library", "advisor", "department", "exit_counseling"]),
  cleared: z.boolean(),
  notes: z.string().optional(),
});

const batchConferralInput = z.object({
  termId: z.string().uuid(),
  ceremonyId: z.string().uuid().optional(),
  conferralDate: z.date(),
  programIds: z.array(z.string().uuid()).optional(),
  validateBeforeConferral: z.boolean().default(true),
  skipValidationFailures: z.boolean().default(false),
  updateStudentStatus: z.boolean().default(true),
  generateTranscripts: z.boolean().default(true),
  reportToNSC: z.boolean().default(true),
  notifyStudents: z.boolean().default(true),
  calculateLatinHonors: z.boolean().default(true),
});

// =============================================================================
// ROUTER
// =============================================================================

export const graduationRouter = router({
  // ============================================================================
  // GRADUATION APPLICATIONS
  // ============================================================================

  /**
   * Apply for graduation
   */
  applyForGraduation: protectedProcedure
    .input(graduationApplicationInput)
    .mutation(async ({ ctx, input }) => {
      // Get the student program
      const program = await ctx.db.query.studentPrograms.findFirst({
        where: eq(studentPrograms.id, input.studentProgramId),
        with: {
          student: true,
        },
      });

      if (!program) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student program not found",
        });
      }

      // Verify the user is this student or has appropriate role
      const isOwnApplication = ctx.user!.studentId === program.studentId;
      const isStaff = ["ADMIN", "REGISTRAR", "ADVISOR"].some((r) =>
        ctx.user!.roles.includes(r)
      );

      if (!isOwnApplication && !isStaff) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to submit this application",
        });
      }

      // Check for existing active application
      const existingApp = await ctx.db.query.graduationApplications.findFirst({
        where: and(
          eq(graduationApplications.studentProgramId, input.studentProgramId),
          inArray(graduationApplications.status, [
            "submitted",
            "audit_review",
            "pending_clearances",
            "clearances_complete",
            "approved",
          ])
        ),
      });

      if (existingApp) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An active graduation application already exists for this program",
        });
      }

      // Get latest degree audit
      const latestAudit = await ctx.db.query.studentDegreeAudits.findFirst({
        where: eq(studentDegreeAudits.studentProgramId, input.studentProgramId),
        orderBy: [desc(studentDegreeAudits.createdAt)],
      });

      // Create the application
      const results = await ctx.db
        .insert(graduationApplications)
        .values({
          studentId: program.studentId,
          studentProgramId: input.studentProgramId,
          institutionId: ctx.user!.institutionId,
          requestedConferralTermId: input.requestedConferralTermId,
          requestedConferralDate: input.requestedConferralDate?.toISOString().split("T")[0],
          ceremonyPreference: input.ceremonyPreference,
          diplomaNameRequested:
            input.diplomaNameRequested ??
            `${program.student.legalFirstName} ${program.student.legalMiddleName ? program.student.legalMiddleName + " " : ""}${program.student.legalLastName}${program.student.suffix ? " " + program.student.suffix : ""}`,
          diplomaMailingAddress: input.diplomaMailingAddress,
          status: "submitted" as GraduationApplicationStatus,
          degreeAuditId: latestAudit?.id,
          degreeAuditCompletionPct: latestAudit?.completionPercentage?.toString(),
        })
        .returning();

      const application = results[0];
      if (!application) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create graduation application",
        });
      }

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "graduation",
          action: "create",
          outcome: "success",
          actorId: ctx.user!.id,
          studentId: program.studentId,
          applicationId: application.id,
          timestamp: new Date().toISOString(),
        })
      );

      return application;
    }),

  /**
   * Get graduation application by ID
   */
  getApplication: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.db.query.graduationApplications.findFirst({
        where: and(
          eq(graduationApplications.id, input.applicationId),
          eq(graduationApplications.institutionId, ctx.user!.institutionId)
        ),
        with: {
          student: true,
          studentProgram: {
            with: {
              majors: true,
            },
          },
          requestedConferralTerm: true,
          ceremony: true,
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      // Check access
      const isStaff = ["ADMIN", "REGISTRAR", "ADVISOR"].some((r) =>
        ctx.user!.roles.includes(r)
      );
      const isOwnApplication = ctx.user!.studentId === application.studentId;

      if (!isStaff && !isOwnApplication) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view this application",
        });
      }

      return application;
    }),

  /**
   * Get student's graduation applications
   */
  getMyApplications: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user!.studentId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User is not a student",
      });
    }

    const applications = await ctx.db.query.graduationApplications.findMany({
      where: eq(graduationApplications.studentId, ctx.user!.studentId),
      with: {
        studentProgram: true,
        requestedConferralTerm: true,
      },
      orderBy: [desc(graduationApplications.applicationDate)],
    });

    return applications;
  }),

  /**
   * List graduation applications (registrar)
   */
  listApplications: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .input(z.object({
      status: z.array(z.string()).optional(),
      termId: z.string().uuid().optional(),
      programId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(graduationApplications.institutionId, ctx.user!.institutionId),
      ];

      if (input.status && input.status.length > 0) {
        conditions.push(
          inArray(
            graduationApplications.status,
            input.status as GraduationApplicationStatus[]
          )
        );
      }
      if (input.termId) {
        conditions.push(eq(graduationApplications.requestedConferralTermId, input.termId));
      }

      const applications = await ctx.db.query.graduationApplications.findMany({
        where: and(...conditions),
        with: {
          student: true,
          studentProgram: {
            with: {
              majors: true,
            },
          },
          requestedConferralTerm: true,
        },
        orderBy: [desc(graduationApplications.applicationDate)],
        limit: input.limit,
        offset: input.offset,
      });

      return applications;
    }),

  // ============================================================================
  // ELIGIBILITY & VALIDATION
  // ============================================================================

  /**
   * Check graduation eligibility for a student program
   */
  checkEligibility: protectedProcedure
    .input(z.object({ studentProgramId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get program with all needed data
      const program = await ctx.db.query.studentPrograms.findFirst({
        where: eq(studentPrograms.id, input.studentProgramId),
        with: {
          student: {
            with: {
              gpaSummary: true,
            },
          },
        },
      });

      if (!program) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student program not found",
        });
      }

      // Check access
      const isStaff = ["ADMIN", "REGISTRAR", "ADVISOR"].some((r) =>
        ctx.user!.roles.includes(r)
      );
      const isOwnProgram = ctx.user!.studentId === program.studentId;

      if (!isStaff && !isOwnProgram) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to check eligibility",
        });
      }

      // Get latest degree audit
      const latestAudit = await ctx.db.query.studentDegreeAudits.findFirst({
        where: eq(studentDegreeAudits.studentProgramId, input.studentProgramId),
        orderBy: [desc(studentDegreeAudits.createdAt)],
      });

      // Get blocking holds (check via holdTypes for blocksGraduation)
      const allHolds = await ctx.db.query.registrationHolds.findMany({
        where: and(
          eq(registrationHolds.studentId, program.studentId),
          isNull(registrationHolds.resolvedAt)
        ),
        with: {
          holdTypeConfig: true,
        },
      });
      // Filter to graduation-blocking holds
      const holds = allHolds.filter((h) => h.holdTypeConfig?.blocksGraduation === true);

      // Get incomplete grades
      const incompleteGrades = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, program.studentId),
          eq(registrations.gradeCode, "I")
        ),
      });

      // Get pending grades (registered but no grade)
      const pendingGrades = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, program.studentId),
          eq(registrations.status, "registered"),
          isNull(registrations.gradeCode)
        ),
      });

      // Build eligibility input
      const gpaSummary = program.student.gpaSummary[0];
      const eligibilityInput: GraduationEligibilityInput = {
        studentId: program.studentId,
        studentProgramId: input.studentProgramId,
        degreeAudit: {
          completionPct: latestAudit?.completionPercentage
            ? Number(latestAudit.completionPercentage)
            : 0,
          allRequirementsComplete: latestAudit?.completionPercentage
            ? Number(latestAudit.completionPercentage) >= 100
            : false,
          missingRequirements: [], // Would parse from audit JSONB
        },
        gpa: {
          cumulative: gpaSummary?.cumulativeGpa ? Number(gpaSummary.cumulativeGpa) : 0,
          institutional: gpaSummary?.cumulativeGpa ? Number(gpaSummary.cumulativeGpa) : 0, // Same for now
        },
        credits: {
          totalEarned: gpaSummary?.cumulativeEarnedCredits
            ? Number(gpaSummary.cumulativeEarnedCredits)
            : 0,
          institutionalEarned: gpaSummary?.cumulativeEarnedCredits
            ? Number(gpaSummary.cumulativeEarnedCredits) -
              Number(gpaSummary?.transferCredits ?? 0)
            : 0,
          transferCredits: gpaSummary?.transferCredits
            ? Number(gpaSummary.transferCredits)
            : 0,
          inProgress: gpaSummary?.inProgressCredits
            ? Number(gpaSummary.inProgressCredits)
            : 0,
        },
        grades: {
          hasIncompleteGrades: incompleteGrades.length > 0,
          incompleteCount: incompleteGrades.length,
          hasPendingFinalGrades: pendingGrades.length > 0,
          pendingCount: pendingGrades.length,
        },
        requirements: {
          minimumGpa: DEFAULT_GRADUATION_POLICY.minimumGpa,
          minimumCredits: DEFAULT_GRADUATION_POLICY.minimumCredits,
          minimumInstitutionalCredits: DEFAULT_GRADUATION_POLICY.minimumInstitutionalCredits,
          milestonesRequired: [],
          milestonesCompleted: [],
        },
        holds: holds.map((h): BlockingHold => ({
          holdId: h.id,
          holdCode: h.holdCode,
          holdName: h.holdName,
          releaseAuthority: h.releaseAuthority ?? "Unknown",
          placedDate: h.effectiveFrom ?? new Date(),
          category: h.holdType as "financial" | "academic" | "administrative" | "disciplinary",
        })),
        financialBalance: 0, // Would fetch from financial module
        libraryClearance: true, // Would check library system
        departmentClearance: false,
        exitCounselingRequired: false, // Would check aid module
        exitCounselingComplete: true,
        isInternational: program.student.citizenshipStatus !== "US_CITIZEN",
        sevisUpdated: true,
        diplomaName: program.diplomaName,
        mailingAddress: null,
        majorDeclared: true, // Would verify from majors
        hasAcademicIntegrityViolation: false,
      };

      const result = validateGraduationEligibility(eligibilityInput);

      return {
        ...result,
        degreeAuditCompletionPct: eligibilityInput.degreeAudit.completionPct,
        latestAuditDate: latestAudit?.createdAt,
      };
    }),

  // ============================================================================
  // CLEARANCES & WORKFLOW
  // ============================================================================

  /**
   * Update clearance status
   */
  updateClearance: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "BURSAR", "ADVISOR"))
    .input(clearanceUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Build the update based on clearance type
      type ClearanceUpdate = {
        updatedAt: Date;
        financialClearance?: boolean;
        financialClearanceDate?: Date | null;
        financialClearanceBy?: string | null;
        libraryClearance?: boolean;
        libraryClearanceDate?: Date | null;
        advisorClearance?: boolean;
        advisorClearanceDate?: Date | null;
        advisorClearanceBy?: string | null;
        departmentClearance?: boolean;
        departmentClearanceDate?: Date | null;
        departmentClearanceBy?: string | null;
        exitCounselingComplete?: boolean;
        exitCounselingCompletedDate?: string | null;
      };

      let updateData: ClearanceUpdate;

      switch (input.clearanceType) {
        case "financial":
          updateData = {
            updatedAt: now,
            financialClearance: input.cleared,
            financialClearanceDate: input.cleared ? now : null,
            financialClearanceBy: input.cleared ? ctx.user!.id : null,
          };
          break;
        case "library":
          updateData = {
            updatedAt: now,
            libraryClearance: input.cleared,
            libraryClearanceDate: input.cleared ? now : null,
          };
          break;
        case "advisor":
          updateData = {
            updatedAt: now,
            advisorClearance: input.cleared,
            advisorClearanceDate: input.cleared ? now : null,
            advisorClearanceBy: input.cleared ? ctx.user!.id : null,
          };
          break;
        case "department":
          updateData = {
            updatedAt: now,
            departmentClearance: input.cleared,
            departmentClearanceDate: input.cleared ? now : null,
            departmentClearanceBy: input.cleared ? ctx.user!.id : null,
          };
          break;
        case "exit_counseling":
          updateData = {
            updatedAt: now,
            exitCounselingComplete: input.cleared,
            exitCounselingCompletedDate: input.cleared
              ? now.toISOString().split("T")[0]
              : null,
          };
          break;
      }

      const results = await ctx.db
        .update(graduationApplications)
        .set(updateData)
        .where(
          and(
            eq(graduationApplications.id, input.applicationId),
            eq(graduationApplications.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      const updated = results[0];

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      // Check if all clearances are now complete
      if (
        updated.financialClearance &&
        updated.libraryClearance &&
        updated.advisorClearance &&
        updated.departmentClearance &&
        (!updated.exitCounselingRequired || updated.exitCounselingComplete)
      ) {
        // Update status to clearances_complete
        await ctx.db
          .update(graduationApplications)
          .set({
            status: "clearances_complete" as GraduationApplicationStatus,
            updatedAt: new Date(),
          })
          .where(eq(graduationApplications.id, input.applicationId));
      }

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "graduation",
          action: "update",
          outcome: "success",
          actorId: ctx.user!.id,
          applicationId: input.applicationId,
          clearanceType: input.clearanceType,
          cleared: input.cleared,
          timestamp: new Date().toISOString(),
        })
      );

      return updated;
    }),

  /**
   * Update application status
   */
  updateStatus: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      applicationId: z.string().uuid(),
      status: z.enum([
        "audit_review",
        "audit_incomplete",
        "pending_clearances",
        "clearances_complete",
        "approved",
        "denied",
        "withdrawn",
      ]),
      notes: z.string().optional(),
      denialReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Build base update data
      type UpdateData = Partial<typeof graduationApplications.$inferInsert>;
      const updateData: UpdateData = {
        status: input.status as GraduationApplicationStatus,
        updatedAt: now,
      };

      // Add status-specific fields
      if (input.status === "audit_review") {
        updateData.auditReviewedBy = ctx.user!.id;
        updateData.auditReviewedAt = now;
        if (input.notes) {
          updateData.auditReviewNotes = input.notes;
        }
      }

      if (input.status === "approved") {
        updateData.registrarApproval = true;
        updateData.registrarApprovalBy = ctx.user!.id;
        updateData.registrarApprovalDate = now;
      }

      if (input.status === "denied" && input.denialReason) {
        updateData.denialReason = input.denialReason;
      }

      if (input.status === "withdrawn") {
        updateData.withdrawnAt = now;
        if (input.notes) {
          updateData.withdrawnReason = input.notes;
        }
      }

      const results = await ctx.db
        .update(graduationApplications)
        .set(updateData)
        .where(
          and(
            eq(graduationApplications.id, input.applicationId),
            eq(graduationApplications.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      const updated = results[0];
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      return updated;
    }),

  /**
   * Approve diploma name
   */
  approveDiplomaName: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      applicationId: z.string().uuid(),
      diplomaNameApproved: z.string().max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(graduationApplications)
        .set({
          diplomaNameApproved: input.diplomaNameApproved,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(graduationApplications.id, input.applicationId),
            eq(graduationApplications.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      return updated;
    }),

  // ============================================================================
  // CONFERRAL
  // ============================================================================

  /**
   * Confer a single degree
   */
  conferDegree: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      applicationId: z.string().uuid(),
      conferralDate: z.date(),
      calculateHonors: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get application with all data
      const application = await ctx.db.query.graduationApplications.findFirst({
        where: and(
          eq(graduationApplications.id, input.applicationId),
          eq(graduationApplications.institutionId, ctx.user!.institutionId)
        ),
        with: {
          student: {
            with: {
              gpaSummary: true,
            },
          },
          studentProgram: true,
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      // Verify status
      if (application.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot confer - application status is ${application.status}, must be approved`,
        });
      }

      // Calculate Latin honors if requested
      let honorsDesignation: LatinHonorsDesignation | null = null;
      if (input.calculateHonors) {
        const gpaSummary = application.student.gpaSummary[0];
        if (gpaSummary) {
          const honorsResult = calculateLatinHonors(
            {
              cumulativeGpa: Number(gpaSummary.cumulativeGpa ?? 0),
              institutionalGpa: Number(gpaSummary.cumulativeGpa ?? 0),
              earnedCredits: Number(gpaSummary.cumulativeEarnedCredits ?? 0),
              institutionalCredits:
                Number(gpaSummary.cumulativeEarnedCredits ?? 0) -
                Number(gpaSummary.transferCredits ?? 0),
              transferCredits: Number(gpaSummary.transferCredits ?? 0),
              hasAcademicIntegrityViolation: false,
            },
            DEFAULT_GRADUATION_POLICY.latinHonors
          );
          honorsDesignation = honorsResult.designation;
        }
      }

      // Update application
      const conferralDateStr = input.conferralDate.toISOString().split("T")[0];
      const [updatedApp] = await ctx.db
        .update(graduationApplications)
        .set({
          status: "conferred" as GraduationApplicationStatus,
          actualConferralDate: conferralDateStr,
          conferredBy: ctx.user!.id,
          conferredAt: new Date(),
          honorsDesignation: honorsDesignation,
          finalGpa: application.student.gpaSummary[0]?.cumulativeGpa,
          honorsCalculatedAt: input.calculateHonors ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(graduationApplications.id, input.applicationId))
        .returning();

      // Update student program
      await ctx.db
        .update(studentPrograms)
        .set({
          status: "graduated",
          degreeAwardedDate: conferralDateStr,
          actualGraduationDate: conferralDateStr,
          honorsDesignation: honorsDesignation
            ? formatLatinHonors(honorsDesignation)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(studentPrograms.id, application.studentProgramId));

      // Update student status
      await ctx.db
        .update(students)
        .set({
          status: "graduated",
          updatedAt: new Date(),
        })
        .where(eq(students.id, application.studentId));

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "graduation",
          action: "confer",
          outcome: "success",
          actorId: ctx.user!.id,
          studentId: application.studentId,
          applicationId: input.applicationId,
          conferralDate: conferralDateStr,
          honorsDesignation,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        application: updatedApp,
        honorsDesignation,
        honorsDisplay: honorsDesignation ? formatLatinHonors(honorsDesignation) : null,
      };
    }),

  // ============================================================================
  // BATCH CONFERRAL
  // ============================================================================

  /**
   * Start batch conferral job
   */
  startBatchConferral: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(batchConferralInput)
    .mutation(async ({ ctx, input }) => {
      // Get all approved applications for this term
      const conditions = [
        eq(graduationApplications.institutionId, ctx.user!.institutionId),
        eq(graduationApplications.requestedConferralTermId, input.termId),
        eq(graduationApplications.status, "approved" as GraduationApplicationStatus),
      ];

      if (input.ceremonyId) {
        conditions.push(eq(graduationApplications.ceremonyId, input.ceremonyId));
      }

      const applications = await ctx.db.query.graduationApplications.findMany({
        where: and(...conditions),
        with: {
          student: {
            with: {
              gpaSummary: true,
            },
          },
          studentProgram: true,
        },
      });

      // Create batch job
      const config: BatchConferralConfig = {
        programIds: input.programIds,
        includeStatuses: ["approved"],
        validateBeforeConferral: input.validateBeforeConferral,
        skipValidationFailures: input.skipValidationFailures,
        updateStudentStatus: input.updateStudentStatus,
        updateProgramStatus: true,
        generateTranscripts: input.generateTranscripts,
        reportToNSC: input.reportToNSC,
        notifyStudents: input.notifyStudents,
        calculateLatinHonors: input.calculateLatinHonors,
        latinHonorsThresholds: {
          summa: DEFAULT_GRADUATION_POLICY.latinHonors.summaThreshold,
          magna: DEFAULT_GRADUATION_POLICY.latinHonors.magnaThreshold,
          cum: DEFAULT_GRADUATION_POLICY.latinHonors.cumThreshold,
        },
      };

      const batchJobValues: typeof batchConferralJobs.$inferInsert = {
        institutionId: ctx.user!.institutionId,
        termId: input.termId,
        ceremonyId: input.ceremonyId ?? null,
        conferralDate: input.conferralDate.toISOString().split("T")[0]!,
        config,
        status: "processing",
        totalEligible: applications.length,
        startedAt: new Date(),
        startedBy: ctx.user!.id,
      };

      const jobResults = await ctx.db
        .insert(batchConferralJobs)
        .values(batchJobValues)
        .returning();

      const job = jobResults[0];
      if (!job) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create batch conferral job",
        });
      }

      // Process each application
      const results: BatchConferralResultEntry[] = [];
      const conferralDateStr = input.conferralDate.toISOString().split("T")[0];

      for (const app of applications) {
        try {
          // Calculate honors
          let honorsDesignation: LatinHonorsDesignation | null = null;
          if (input.calculateLatinHonors) {
            const gpaSummary = app.student.gpaSummary[0];
            if (gpaSummary) {
              const honorsResult = calculateLatinHonors(
                {
                  cumulativeGpa: Number(gpaSummary.cumulativeGpa ?? 0),
                  institutionalGpa: Number(gpaSummary.cumulativeGpa ?? 0),
                  earnedCredits: Number(gpaSummary.cumulativeEarnedCredits ?? 0),
                  institutionalCredits:
                    Number(gpaSummary.cumulativeEarnedCredits ?? 0) -
                    Number(gpaSummary.transferCredits ?? 0),
                  transferCredits: Number(gpaSummary.transferCredits ?? 0),
                  hasAcademicIntegrityViolation: false,
                },
                DEFAULT_GRADUATION_POLICY.latinHonors
              );
              honorsDesignation = honorsResult.designation;
            }
          }

          // Update application
          await ctx.db
            .update(graduationApplications)
            .set({
              status: "conferred" as GraduationApplicationStatus,
              actualConferralDate: conferralDateStr,
              conferredBy: ctx.user!.id,
              conferredAt: new Date(),
              honorsDesignation,
              finalGpa: app.student.gpaSummary[0]?.cumulativeGpa,
              honorsCalculatedAt: input.calculateLatinHonors ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(graduationApplications.id, app.id));

          // Update student program
          await ctx.db
            .update(studentPrograms)
            .set({
              status: "graduated",
              degreeAwardedDate: conferralDateStr,
              actualGraduationDate: conferralDateStr,
              honorsDesignation: honorsDesignation
                ? formatLatinHonors(honorsDesignation)
                : null,
              updatedAt: new Date(),
            })
            .where(eq(studentPrograms.id, app.studentProgramId));

          // Update student status
          if (input.updateStudentStatus) {
            await ctx.db
              .update(students)
              .set({
                status: "graduated",
                updatedAt: new Date(),
              })
              .where(eq(students.id, app.studentId));
          }

          results.push({
            studentId: app.studentId,
            studentProgramId: app.studentProgramId,
            graduationApplicationId: app.id,
            status: "conferred",
            honorsDesignation: honorsDesignation ?? undefined,
          });
        } catch (error) {
          results.push({
            studentId: app.studentId,
            studentProgramId: app.studentProgramId,
            graduationApplicationId: app.id,
            status: "failed",
            failureReason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Update job with results
      const conferred = results.filter((r) => r.status === "conferred").length;
      const failed = results.filter((r) => r.status === "failed").length;

      await ctx.db
        .update(batchConferralJobs)
        .set({
          status: "completed",
          totalConferred: conferred,
          totalFailed: failed,
          results,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(batchConferralJobs.id, job.id));

      // Audit log
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "graduation",
          action: "batch_confer",
          outcome: "success",
          actorId: ctx.user!.id,
          jobId: job.id,
          totalEligible: applications.length,
          totalConferred: conferred,
          totalFailed: failed,
          timestamp: new Date().toISOString(),
        })
      );

      return {
        jobId: job.id,
        totalEligible: applications.length,
        totalConferred: conferred,
        totalFailed: failed,
        results,
      };
    }),

  /**
   * Get batch conferral job status
   */
  getBatchJob: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.batchConferralJobs.findFirst({
        where: and(
          eq(batchConferralJobs.id, input.jobId),
          eq(batchConferralJobs.institutionId, ctx.user!.institutionId)
        ),
        with: {
          term: true,
          ceremony: true,
          startedByUser: true,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch conferral job not found",
        });
      }

      return job;
    }),

  // ============================================================================
  // COMMENCEMENT CEREMONIES
  // ============================================================================

  /**
   * Create commencement ceremony
   */
  createCeremony: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({
      termId: z.string().uuid(),
      name: z.string().max(200),
      ceremonyType: z.enum(["main", "college", "department"]).optional(),
      ceremonyDate: z.date(),
      ceremonyTime: z.string().optional(),
      locationName: z.string().max(200).optional(),
      locationAddress: z.string().optional(),
      maxParticipants: z.number().int().optional(),
      guestTicketsPerStudent: z.number().int().default(4),
      rsvpOpenDate: z.date().optional(),
      rsvpDeadlineDate: z.date().optional(),
      conferralDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ceremonyValues: typeof commencementCeremonies.$inferInsert = {
        institutionId: ctx.user!.institutionId,
        termId: input.termId,
        name: input.name,
        ceremonyType: input.ceremonyType ?? null,
        ceremonyDate: input.ceremonyDate.toISOString().split("T")[0]!,
        ceremonyTime: input.ceremonyTime ?? null,
        locationName: input.locationName ?? null,
        locationAddress: input.locationAddress ?? null,
        maxParticipants: input.maxParticipants ?? null,
        guestTicketsPerStudent: input.guestTicketsPerStudent,
        rsvpOpenDate: input.rsvpOpenDate?.toISOString().split("T")[0] ?? null,
        rsvpDeadlineDate: input.rsvpDeadlineDate?.toISOString().split("T")[0] ?? null,
        conferralDate: input.conferralDate?.toISOString().split("T")[0] ?? null,
      };

      const ceremonyResults = await ctx.db
        .insert(commencementCeremonies)
        .values(ceremonyValues)
        .returning();

      const ceremony = ceremonyResults[0];
      if (!ceremony) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create ceremony",
        });
      }

      return ceremony;
    }),

  /**
   * List ceremonies for a term
   */
  listCeremonies: protectedProcedure
    .input(z.object({ termId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ceremonies = await ctx.db.query.commencementCeremonies.findMany({
        where: and(
          eq(commencementCeremonies.institutionId, ctx.user!.institutionId),
          eq(commencementCeremonies.termId, input.termId)
        ),
        orderBy: [desc(commencementCeremonies.ceremonyDate)],
      });

      return ceremonies;
    }),

  /**
   * Register for ceremony
   */
  registerForCeremony: protectedProcedure
    .input(z.object({
      graduationApplicationId: z.string().uuid(),
      ceremonyId: z.string().uuid(),
      programName: z.string().max(200).optional(),
      guestTicketsRequested: z.number().int().min(0).max(10).default(0),
      accessibilityNeeds: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the application
      const application = await ctx.db.query.graduationApplications.findFirst({
        where: eq(graduationApplications.id, input.graduationApplicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Graduation application not found",
        });
      }

      // Check access
      const isStaff = ["ADMIN", "REGISTRAR"].some((r) => ctx.user!.roles.includes(r));
      const isOwnApplication = ctx.user!.studentId === application.studentId;

      if (!isStaff && !isOwnApplication) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to register for this ceremony",
        });
      }

      // Create participant record
      const [participant] = await ctx.db
        .insert(ceremonyParticipants)
        .values({
          ceremonyId: input.ceremonyId,
          graduationApplicationId: input.graduationApplicationId,
          studentId: application.studentId,
          programName: input.programName,
          guestTicketsRequested: input.guestTicketsRequested,
          accessibilityNeeds: input.accessibilityNeeds,
        })
        .returning();

      // Update application with ceremony
      await ctx.db
        .update(graduationApplications)
        .set({
          ceremonyId: input.ceremonyId,
          updatedAt: new Date(),
        })
        .where(eq(graduationApplications.id, input.graduationApplicationId));

      // Update ceremony participant count
      await ctx.db
        .update(commencementCeremonies)
        .set({
          currentParticipants: sql`${commencementCeremonies.currentParticipants} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(commencementCeremonies.id, input.ceremonyId));

      return participant;
    }),
});
