/**
 * Degree Audit Router
 *
 * tRPC router for degree audit and program requirements management.
 */

import { z } from "zod";
import { router, protectedProcedure, requireRole, canAccessStudent } from "../trpc.js";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  programs,
  catalogYears,
  courses,
  subjects,
  requirementCategories,
  programRequirements,
  requirementCourses,
  requirementCourseGroups,
  requirementCourseGroupCourses,
  studentDegreeAudits,
  students,
  studentPrograms,
  registrations,
  transferCredits,
  testScores,
  studentGpaSummary,
  sections,
} from "@sis/db/schema";
import {
  calculateDegreeAudit,
  getDegreeProgressSummary,
  type DegreeAuditInput,
  type DegreeRequirement,
  type StudentCourse,
  type RequirementCourse as DomainReqCourse,
  type RequirementCourseGroup as DomainReqGroup,
} from "@sis/domain";

export const degreeAuditRouter = router({
  // ============================================================================
  // REQUIREMENT CATEGORIES
  // ============================================================================

  /**
   * Get all requirement categories
   */
  getCategories: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx }) => {
      const categories = await ctx.db.query.requirementCategories.findMany({
        where: and(
          eq(requirementCategories.institutionId, ctx.user!.institutionId),
          eq(requirementCategories.isActive, true)
        ),
        orderBy: [asc(requirementCategories.displayOrder)],
      });

      return categories;
    }),

  /**
   * Create a requirement category
   */
  createCategory: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        code: z.string().min(2).max(30),
        name: z.string().min(2).max(100),
        description: z.string().optional(),
        displayOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate code
      const existing = await ctx.db.query.requirementCategories.findFirst({
        where: and(
          eq(requirementCategories.institutionId, ctx.user!.institutionId),
          eq(requirementCategories.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Category with code "${input.code}" already exists`,
        });
      }

      const [category] = await ctx.db
        .insert(requirementCategories)
        .values({
          institutionId: ctx.user!.institutionId,
          code: input.code,
          name: input.name,
          description: input.description,
          displayOrder: input.displayOrder,
        })
        .returning();

      return category;
    }),

  /**
   * Update a requirement category
   */
  updateCategory: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(2).max(30).optional(),
        name: z.string().min(2).max(100).optional(),
        description: z.string().optional().nullable(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [updated] = await ctx.db
        .update(requirementCategories)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(requirementCategories.id, id),
            eq(requirementCategories.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      return updated;
    }),

  // ============================================================================
  // PROGRAM REQUIREMENTS
  // ============================================================================

  /**
   * Get requirements for a program
   */
  getProgramRequirements: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .input(
      z.object({
        programId: z.string().uuid(),
        catalogYearId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(programRequirements.programId, input.programId),
        eq(programRequirements.isActive, true),
      ];

      if (input.catalogYearId) {
        conditions.push(eq(programRequirements.catalogYearId, input.catalogYearId));
      }

      const requirements = await ctx.db.query.programRequirements.findMany({
        where: and(...conditions),
        with: {
          category: true,
          courses: {
            with: {
              course: {
                with: {
                  subject: true,
                },
              },
            },
          },
          courseGroups: {
            with: {
              courses: {
                with: {
                  course: {
                    with: {
                      subject: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [asc(programRequirements.displayOrder)],
      });

      return requirements.map((req) => ({
        id: req.id,
        name: req.name,
        description: req.description,
        categoryId: req.categoryId,
        categoryName: req.category?.name ?? null,
        minimumCredits: req.minimumCredits ? parseFloat(req.minimumCredits) : null,
        maximumCredits: req.maximumCredits ? parseFloat(req.maximumCredits) : null,
        minimumCourses: req.minimumCourses,
        minimumGpa: req.minimumGpa ? parseFloat(req.minimumGpa) : null,
        allowSharing: req.allowSharing ?? false,
        displayOrder: req.displayOrder ?? 0,
        courses: req.courses.map((rc) => ({
          id: rc.id,
          courseId: rc.courseId,
          courseCode: rc.course?.courseCode ?? `${rc.course?.subject?.code} ${rc.course?.courseNumber}`,
          courseTitle: rc.course?.title ?? "Unknown",
          credits: rc.course?.creditHoursMin ? parseFloat(rc.course.creditHoursMin) : 0,
          isRequired: rc.isRequired ?? true,
          minimumGrade: rc.minimumGrade,
        })),
        courseGroups: req.courseGroups.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          minimumCourses: group.minimumCourses,
          minimumCredits: group.minimumCredits ? parseFloat(group.minimumCredits) : null,
          selectionRule: group.selectionRule,
          courses: group.courses.map((gc) => ({
            courseId: gc.courseId,
            courseCode: gc.course?.courseCode ?? `${gc.course?.subject?.code} ${gc.course?.courseNumber}`,
            courseTitle: gc.course?.title ?? "Unknown",
            credits: gc.course?.creditHoursMin ? parseFloat(gc.course.creditHoursMin) : 0,
          })),
        })),
      }));
    }),

  /**
   * Create a program requirement
   */
  createRequirement: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        programId: z.string().uuid(),
        catalogYearId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        name: z.string().min(2).max(200),
        description: z.string().optional(),
        minimumCredits: z.number().optional(),
        maximumCredits: z.number().optional(),
        minimumCourses: z.number().optional(),
        minimumGpa: z.number().optional(),
        allowSharing: z.boolean().default(false),
        displayOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [requirement] = await ctx.db
        .insert(programRequirements)
        .values({
          programId: input.programId,
          catalogYearId: input.catalogYearId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          minimumCredits: input.minimumCredits?.toString(),
          maximumCredits: input.maximumCredits?.toString(),
          minimumCourses: input.minimumCourses,
          minimumGpa: input.minimumGpa?.toString(),
          allowSharing: input.allowSharing,
          displayOrder: input.displayOrder,
        })
        .returning();

      return requirement;
    }),

  /**
   * Update a program requirement
   */
  updateRequirement: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(2).max(200).optional(),
        description: z.string().optional().nullable(),
        categoryId: z.string().uuid().optional().nullable(),
        minimumCredits: z.number().optional().nullable(),
        maximumCredits: z.number().optional().nullable(),
        minimumCourses: z.number().optional().nullable(),
        minimumGpa: z.number().optional().nullable(),
        allowSharing: z.boolean().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, minimumCredits, maximumCredits, minimumGpa, ...rest } = input;

      const [updated] = await ctx.db
        .update(programRequirements)
        .set({
          ...rest,
          minimumCredits: minimumCredits?.toString() ?? null,
          maximumCredits: maximumCredits?.toString() ?? null,
          minimumGpa: minimumGpa?.toString() ?? null,
          updatedAt: new Date(),
        })
        .where(eq(programRequirements.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Requirement not found",
        });
      }

      return updated;
    }),

  /**
   * Add a course to a requirement
   */
  addCourseToRequirement: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        requirementId: z.string().uuid(),
        courseId: z.string().uuid(),
        isRequired: z.boolean().default(true),
        minimumGrade: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if already exists
      const existing = await ctx.db.query.requirementCourses.findFirst({
        where: and(
          eq(requirementCourses.requirementId, input.requirementId),
          eq(requirementCourses.courseId, input.courseId)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Course already added to this requirement",
        });
      }

      const [rc] = await ctx.db
        .insert(requirementCourses)
        .values({
          requirementId: input.requirementId,
          courseId: input.courseId,
          isRequired: input.isRequired,
          minimumGrade: input.minimumGrade,
        })
        .returning();

      return rc;
    }),

  /**
   * Remove a course from a requirement
   */
  removeCourseFromRequirement: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        requirementCourseId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(requirementCourses)
        .where(eq(requirementCourses.id, input.requirementCourseId));

      return { success: true };
    }),

  // ============================================================================
  // DEGREE AUDIT
  // ============================================================================

  /**
   * Run a degree audit for a student
   */
  runAudit: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        studentProgramId: z.string().uuid(),
        includeInProgress: z.boolean().default(true),
        saveResult: z.boolean().default(true),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      // Get student program info
      const studentProgram = await ctx.db.query.studentPrograms.findFirst({
        where: eq(studentPrograms.id, input.studentProgramId),
      });

      if (!studentProgram) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student program not found",
        });
      }

      // Fetch program and catalog year separately (cross-schema)
      const program = await ctx.db.query.programs.findFirst({
        where: eq(programs.id, studentProgram.programId),
        with: {
          degreeType: true,
        },
      });

      const catalogYear = studentProgram.catalogYearId
        ? await ctx.db.query.catalogYears.findFirst({
            where: eq(catalogYears.id, studentProgram.catalogYearId),
          })
        : null;

      // Get program requirements
      const requirements = await ctx.db.query.programRequirements.findMany({
        where: and(
          eq(programRequirements.programId, studentProgram.programId),
          eq(programRequirements.isActive, true)
        ),
        with: {
          category: true,
          courses: {
            with: {
              course: {
                with: {
                  subject: true,
                },
              },
            },
          },
          courseGroups: {
            with: {
              courses: {
                with: {
                  course: {
                    with: {
                      subject: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [asc(programRequirements.displayOrder)],
      });

      // Get student's courses from registrations
      const studentRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          inArray(registrations.status, ["completed", "registered"])
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
        },
      });

      // Get transfer credits
      const studentTransfers = await ctx.db.query.transferCredits.findMany({
        where: and(
          eq(transferCredits.studentId, input.studentId),
          eq(transferCredits.status, "approved")
        ),
        with: {
          equivalentCourse: {
            with: {
              subject: true,
            },
          },
        },
      });

      // Get test credits (AP, CLEP, etc.)
      const studentTests = await ctx.db.query.testScores.findMany({
        where: and(
          eq(testScores.studentId, input.studentId),
          eq(testScores.status, "official")
        ),
        with: {
          equivalentCourse: {
            with: {
              subject: true,
            },
          },
        },
      });

      // Get GPA summary
      const gpaSummary = await ctx.db.query.studentGpaSummary.findFirst({
        where: eq(studentGpaSummary.studentId, input.studentId),
      });

      // Transform to domain types
      const studentCourses: StudentCourse[] = [];

      // Add registrations
      for (const reg of studentRegistrations) {
        if (!reg.section?.course) continue;
        const course = reg.section.course;

        studentCourses.push({
          id: reg.id,
          courseId: course.id,
          courseCode: course.courseCode ?? `${course.subject?.code} ${course.courseNumber}`,
          courseTitle: course.title,
          credits: reg.creditsEarned ? parseFloat(reg.creditsEarned) : parseFloat(reg.creditHours),
          grade: reg.gradeCode,
          gradePoints: reg.gradePoints ? parseFloat(reg.gradePoints) : null,
          source: "registration",
          status: reg.status === "completed" ? "completed" : "in_progress",
          termId: reg.termId,
          subjectCode: course.subject?.code ?? "",
          courseNumber: course.courseNumber,
          attributes: (course.attributes as string[]) ?? [],
        });
      }

      // Add transfer credits
      for (const transfer of studentTransfers) {
        if (!transfer.equivalentCourse) continue;
        const course = transfer.equivalentCourse;

        studentCourses.push({
          id: transfer.id,
          courseId: course.id,
          courseCode: course.courseCode ?? `${course.subject?.code} ${course.courseNumber}`,
          courseTitle: course.title,
          credits: parseFloat(transfer.transferCredits),
          grade: null, // Transfer credits typically don't have grades
          gradePoints: null,
          source: "transfer",
          status: "completed",
          termId: null,
          subjectCode: course.subject?.code ?? "",
          courseNumber: course.courseNumber,
          attributes: (course.attributes as string[]) ?? [],
        });
      }

      // Add test credits
      for (const test of studentTests) {
        if (!test.equivalentCourse || !test.creditAwarded) continue;
        const course = test.equivalentCourse;

        studentCourses.push({
          id: test.id,
          courseId: course.id,
          courseCode: course.courseCode ?? `${course.subject?.code} ${course.courseNumber}`,
          courseTitle: course.title,
          credits: parseFloat(test.creditAwarded),
          grade: null,
          gradePoints: null,
          source: "test_credit",
          status: "completed",
          termId: null,
          subjectCode: course.subject?.code ?? "",
          courseNumber: course.courseNumber,
          attributes: (course.attributes as string[]) ?? [],
        });
      }

      // Transform requirements to domain types
      const domainRequirements: DegreeRequirement[] = requirements.map((req) => ({
        id: req.id,
        name: req.name,
        description: req.description,
        categoryId: req.categoryId,
        categoryName: req.category?.name ?? null,
        minimumCredits: req.minimumCredits ? parseFloat(req.minimumCredits) : null,
        maximumCredits: req.maximumCredits ? parseFloat(req.maximumCredits) : null,
        minimumCourses: req.minimumCourses,
        minimumGpa: req.minimumGpa ? parseFloat(req.minimumGpa) : null,
        allowSharing: req.allowSharing ?? false,
        displayOrder: req.displayOrder ?? 0,
        requiredCourses: req.courses.map((rc): DomainReqCourse => ({
          courseId: rc.courseId,
          courseCode: rc.course?.courseCode ?? `${rc.course?.subject?.code} ${rc.course?.courseNumber}`,
          courseTitle: rc.course?.title ?? "Unknown",
          credits: rc.course?.creditHoursMin ? parseFloat(rc.course.creditHoursMin) : 0,
          isRequired: rc.isRequired ?? true,
          minimumGrade: rc.minimumGrade,
        })),
        courseGroups: req.courseGroups.map((group): DomainReqGroup => ({
          id: group.id,
          name: group.name,
          description: group.description,
          minimumCourses: group.minimumCourses,
          minimumCredits: group.minimumCredits ? parseFloat(group.minimumCredits) : null,
          selectionRule: group.selectionRule,
          courses: group.courses.map((gc) => ({
            courseId: gc.courseId,
            courseCode: gc.course?.courseCode ?? `${gc.course?.subject?.code} ${gc.course?.courseNumber}`,
            courseTitle: gc.course?.title ?? "Unknown",
            credits: gc.course?.creditHoursMin ? parseFloat(gc.course.creditHoursMin) : 0,
            isRequired: false,
            minimumGrade: null,
          })),
        })),
      }));

      // Build audit input
      const auditInput: DegreeAuditInput = {
        studentId: input.studentId,
        studentProgramId: input.studentProgramId,
        programId: studentProgram.programId,
        programName: program?.name ?? "Unknown Program",
        programCode: program?.code ?? "???",
        totalCreditsRequired: program?.totalCredits
          ? parseFloat(program.totalCredits)
          : 120,
        catalogYearId: studentProgram.catalogYearId,
        catalogYearCode: catalogYear?.code ?? null,
        overallGpaRequired: 2.0, // Default - could be program-specific
        majorGpaRequired: null,
        overallGpaActual: gpaSummary?.cumulativeGpa
          ? parseFloat(gpaSummary.cumulativeGpa)
          : null,
        requirements: domainRequirements,
        studentCourses,
      };

      // Run the audit
      const auditResult = calculateDegreeAudit(auditInput, {
        includeInProgress: input.includeInProgress,
      });

      // Save result if requested
      if (input.saveResult) {
        // Transform to schema types for JSONB fields
        const requirementsStatusData = auditResult.requirements.map((r) => ({
          requirementId: r.requirementId,
          requirementName: r.requirementName,
          categoryName: r.categoryName ?? "",
          status: r.status as "complete" | "in_progress" | "incomplete" | "not_started",
          creditsRequired: r.creditsRequired,
          creditsEarned: r.creditsEarned,
          creditsInProgress: r.creditsInProgress,
          gpaRequired: r.gpaRequired ?? undefined,
          gpaActual: r.gpaActual ?? undefined,
          coursesRequired: r.coursesRequired,
          coursesCompleted: r.coursesCompleted,
          coursesInProgress: r.coursesInProgress,
          appliedCourses: r.appliedCourses.map((c) => c.courseId),
          missingCourses: r.missingCourses.map((c) => c.courseId),
        }));

        const coursesAppliedData = auditResult.coursesApplied.map((c) => ({
          courseId: c.courseId,
          courseCode: c.courseCode,
          registrationId: c.source === "registration" ? c.sourceId : undefined,
          transferCreditId: c.source === "transfer" ? c.sourceId : undefined,
          testScoreId: c.source === "test_credit" ? c.sourceId : undefined,
          creditsEarned: c.credits,
          grade: c.grade ?? undefined,
          gradePoints: c.gradePoints ?? undefined,
          termId: c.termId ?? undefined,
          requirementIds: c.requirementIds,
          status: c.status as "completed" | "in_progress" | "transfer" | "test_credit",
        }));

        await ctx.db.insert(studentDegreeAudits).values({
          studentId: input.studentId,
          studentProgramId: input.studentProgramId,
          programId: studentProgram.programId,
          catalogYearId: studentProgram.catalogYearId,
          totalCreditsRequired: auditResult.totalCreditsRequired.toString(),
          totalCreditsEarned: auditResult.totalCreditsEarned.toString(),
          totalCreditsInProgress: auditResult.totalCreditsInProgress.toString(),
          overallGpaRequired: auditResult.overallGpaRequired?.toString(),
          overallGpaActual: auditResult.overallGpaActual?.toString(),
          majorGpaRequired: auditResult.majorGpaRequired?.toString(),
          majorGpaActual: auditResult.majorGpaActual?.toString(),
          completionPercentage: auditResult.completionPercentage.toString(),
          requirementsStatus: requirementsStatusData,
          coursesApplied: coursesAppliedData,
          status: "calculated",
          generatedBy: ctx.user!.id,
        });
      }

      return auditResult;
    }),

  /**
   * Get audit history for a student
   */
  getAuditHistory: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        studentProgramId: z.string().uuid().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(studentDegreeAudits.studentId, input.studentId)];

      if (input.studentProgramId) {
        conditions.push(eq(studentDegreeAudits.studentProgramId, input.studentProgramId));
      }

      const audits = await ctx.db.query.studentDegreeAudits.findMany({
        where: and(...conditions),
        with: {
          program: true,
          catalogYear: true,
        },
        orderBy: [desc(studentDegreeAudits.auditDate)],
        limit: input.limit,
      });

      return audits.map((audit) => ({
        id: audit.id,
        auditDate: audit.auditDate,
        programName: audit.program?.name ?? "Unknown",
        catalogYearCode: audit.catalogYear?.code ?? null,
        completionPercentage: audit.completionPercentage
          ? parseFloat(audit.completionPercentage)
          : 0,
        totalCreditsEarned: audit.totalCreditsEarned
          ? parseFloat(audit.totalCreditsEarned)
          : 0,
        totalCreditsRequired: audit.totalCreditsRequired
          ? parseFloat(audit.totalCreditsRequired)
          : 0,
        overallGpaActual: audit.overallGpaActual
          ? parseFloat(audit.overallGpaActual)
          : null,
        status: audit.status,
      }));
    }),

  /**
   * Get a specific audit result
   */
  getAudit: protectedProcedure
    .input(z.object({ auditId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const audit = await ctx.db.query.studentDegreeAudits.findFirst({
        where: eq(studentDegreeAudits.id, input.auditId),
        with: {
          program: true,
          catalogYear: true,
        },
      });

      if (!audit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Audit not found",
        });
      }

      // Verify access
      const hasAccess =
        ctx.user?.studentId === audit.studentId ||
        ctx.user?.roles.includes("ADMIN") ||
        ctx.user?.roles.includes("REGISTRAR") ||
        ctx.user?.roles.includes("ADVISOR");

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      return {
        id: audit.id,
        studentId: audit.studentId,
        studentProgramId: audit.studentProgramId,
        programName: audit.program?.name ?? "Unknown",
        catalogYearCode: audit.catalogYear?.code ?? null,
        auditDate: audit.auditDate,
        totalCreditsRequired: audit.totalCreditsRequired
          ? parseFloat(audit.totalCreditsRequired)
          : 0,
        totalCreditsEarned: audit.totalCreditsEarned
          ? parseFloat(audit.totalCreditsEarned)
          : 0,
        totalCreditsInProgress: audit.totalCreditsInProgress
          ? parseFloat(audit.totalCreditsInProgress)
          : 0,
        completionPercentage: audit.completionPercentage
          ? parseFloat(audit.completionPercentage)
          : 0,
        overallGpaRequired: audit.overallGpaRequired
          ? parseFloat(audit.overallGpaRequired)
          : null,
        overallGpaActual: audit.overallGpaActual
          ? parseFloat(audit.overallGpaActual)
          : null,
        majorGpaRequired: audit.majorGpaRequired
          ? parseFloat(audit.majorGpaRequired)
          : null,
        majorGpaActual: audit.majorGpaActual
          ? parseFloat(audit.majorGpaActual)
          : null,
        requirementsStatus: audit.requirementsStatus ?? [],
        coursesApplied: audit.coursesApplied ?? [],
        status: audit.status,
        advisorNotes: audit.advisorNotes,
      };
    }),

  /**
   * Get degree progress summary for a student (quick overview)
   */
  getProgressSummary: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        studentProgramId: z.string().uuid(),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Get the most recent audit
      const latestAudit = await ctx.db.query.studentDegreeAudits.findFirst({
        where: and(
          eq(studentDegreeAudits.studentId, input.studentId),
          eq(studentDegreeAudits.studentProgramId, input.studentProgramId)
        ),
        orderBy: [desc(studentDegreeAudits.auditDate)],
        with: {
          program: true,
        },
      });

      if (!latestAudit) {
        return null;
      }

      const completionPercentage = latestAudit.completionPercentage
        ? parseFloat(latestAudit.completionPercentage)
        : 0;
      const creditsEarned = latestAudit.totalCreditsEarned
        ? parseFloat(latestAudit.totalCreditsEarned)
        : 0;
      const creditsRequired = latestAudit.totalCreditsRequired
        ? parseFloat(latestAudit.totalCreditsRequired)
        : 0;

      const requirements = (latestAudit.requirementsStatus as any[]) ?? [];
      const requirementsComplete = requirements.filter(
        (r) => r.status === "complete"
      ).length;

      return {
        auditDate: latestAudit.auditDate,
        programName: latestAudit.program?.name ?? "Unknown",
        completionPercentage,
        creditsEarned,
        creditsRequired,
        creditsRemaining: Math.max(0, creditsRequired - creditsEarned),
        requirementsComplete,
        requirementsTotal: requirements.length,
        overallGpa: latestAudit.overallGpaActual
          ? parseFloat(latestAudit.overallGpaActual)
          : null,
        status: latestAudit.status,
      };
    }),

  // ============================================================================
  // PROGRAMS (for selection)
  // ============================================================================

  /**
   * Get programs for the institution
   */
  getPrograms: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(programs.institutionId, ctx.user!.institutionId)];

      if (!input?.includeInactive) {
        conditions.push(eq(programs.isActive, true));
      }

      const programsList = await ctx.db.query.programs.findMany({
        where: and(...conditions),
        with: {
          department: true,
          degreeType: true,
        },
        orderBy: [asc(programs.name)],
      });

      return programsList.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        totalCredits: p.totalCredits ? parseFloat(p.totalCredits) : null,
        departmentName: p.department?.name ?? null,
        degreeType: p.degreeType?.code ?? null,
        status: p.status,
      }));
    }),

  /**
   * Get catalog years
   */
  getCatalogYears: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR"))
    .query(async ({ ctx }) => {
      const years = await ctx.db.query.catalogYears.findMany({
        where: and(
          eq(catalogYears.institutionId, ctx.user!.institutionId),
          eq(catalogYears.isActive, true)
        ),
        orderBy: [desc(catalogYears.startDate)],
      });

      return years;
    }),
});
