/**
 * Admin Router
 *
 * tRPC router for administrative operations and dashboard views.
 * All procedures require ADMIN or REGISTRAR role.
 */

import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import { eq, and, count, isNull, sql, like, desc } from "drizzle-orm";
import {
  students,
  registrations,
  registrationHolds,
  terms,
  termSessions,
  academicYears,
  sections,
  courses,
  subjects,
  users,
} from "@sis/db/schema";
import { TRPCError } from "@trpc/server";

export const adminRouter = router({
  /**
   * Get dashboard statistics for admin overview
   */
  getDashboardStats: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx }) => {
      // Get total active students
      const [totalStudentsResult] = await ctx.db
        .select({ count: count() })
        .from(students)
        .where(
          and(
            eq(students.institutionId, ctx.user!.institutionId),
            eq(students.status, "active")
          )
        );

      const totalStudents = totalStudentsResult?.count ?? 0;

      // Get current term
      const currentTerm = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.institutionId, ctx.user!.institutionId),
          eq(terms.isCurrent, true)
        ),
      });

      let currentTermEnrollments = 0;
      if (currentTerm) {
        const [enrollmentsResult] = await ctx.db
          .select({ count: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.termId, currentTerm.id),
              eq(registrations.status, "registered")
            )
          );

        currentTermEnrollments = enrollmentsResult?.count ?? 0;
      }

      // Get active holds count
      const [activeHoldsResult] = await ctx.db
        .select({ count: count() })
        .from(registrationHolds)
        .innerJoin(students, eq(registrationHolds.studentId, students.id))
        .where(
          and(
            eq(students.institutionId, ctx.user!.institutionId),
            isNull(registrationHolds.resolvedAt)
          )
        );

      const activeHolds = activeHoldsResult?.count ?? 0;

      return {
        totalStudents,
        currentTermEnrollments,
        activeHolds,
        currentTermId: currentTerm?.id ?? null,
        currentTermName: currentTerm?.name ?? null,
      };
    }),

  /**
   * Get all available terms for the institution
   */
  getTerms: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(terms.institutionId, ctx.user!.institutionId)];

      if (!input?.includeInactive) {
        filters.push(eq(terms.isActive, true));
      }

      const termsList = await ctx.db.query.terms.findMany({
        where: and(...filters),
        orderBy: (terms, { desc }) => [desc(terms.startDate)],
        limit: input?.limit ?? 50,
        with: {
          academicYear: true,
        },
      });

      return termsList.map((term) => ({
        id: term.id,
        code: term.code,
        name: term.name,
        shortName: term.shortName,
        termType: term.termType,
        startDate: term.startDate,
        endDate: term.endDate,
        isCurrent: term.isCurrent,
        isVisible: term.isVisible,
        allowRegistration: term.allowRegistration,
        academicYear: term.academicYear
          ? {
              code: term.academicYear.code,
              name: term.academicYear.name,
            }
          : null,
        registrationStartDate: term.registrationStartDate,
        registrationEndDate: term.registrationEndDate,
        addDeadline: term.addDeadline,
        dropDeadline: term.dropDeadline,
        withdrawalDeadline: term.withdrawalDeadline,
      }));
    }),

  /**
   * Get the current active term
   */
  getCurrentTerm: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx }) => {
      const currentTerm = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.institutionId, ctx.user!.institutionId),
          eq(terms.isCurrent, true)
        ),
        with: {
          academicYear: true,
        },
      });

      if (!currentTerm) {
        return null;
      }

      return {
        id: currentTerm.id,
        code: currentTerm.code,
        name: currentTerm.name,
        shortName: currentTerm.shortName,
        termType: currentTerm.termType,
        startDate: currentTerm.startDate,
        endDate: currentTerm.endDate,
        censusDate: currentTerm.censusDate,
        isCurrent: currentTerm.isCurrent,
        isVisible: currentTerm.isVisible,
        allowRegistration: currentTerm.allowRegistration,
        academicYear: currentTerm.academicYear
          ? {
              code: currentTerm.academicYear.code,
              name: currentTerm.academicYear.name,
            }
          : null,
        registrationStartDate: currentTerm.registrationStartDate,
        registrationEndDate: currentTerm.registrationEndDate,
        addDeadline: currentTerm.addDeadline,
        dropDeadline: currentTerm.dropDeadline,
        withdrawalDeadline: currentTerm.withdrawalDeadline,
        midtermGradesDue: currentTerm.midtermGradesDue,
        finalGradesDue: currentTerm.finalGradesDue,
        tuitionDueDate: currentTerm.tuitionDueDate,
      };
    }),

  /**
   * Get sections for a term with enrollment counts
   */
  getSections: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        termId: z.string().uuid(),
        searchQuery: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where conditions
      const conditions = [eq(sections.termId, input.termId)];

      // Get sections with course and enrollment data
      const sectionsData = await ctx.db
        .select({
          id: sections.id,
          sectionNumber: sections.sectionNumber,
          crn: sections.crn,
          creditHours: sections.creditHours,
          maxEnrollment: sections.maxEnrollment,
          currentEnrollment: sections.currentEnrollment,
          waitlistMax: sections.waitlistMax,
          waitlistCurrent: sections.waitlistCurrent,
          status: sections.status,
          instructionalMethod: sections.instructionalMethod,
          courseId: courses.id,
          courseCode: courses.courseCode,
          courseTitle: courses.title,
          courseNumber: courses.courseNumber,
          subjectCode: subjects.code,
          instructorId: users.id,
          instructorFirstName: users.firstName,
          instructorLastName: users.lastName,
        })
        .from(sections)
        .innerJoin(courses, eq(sections.courseId, courses.id))
        .innerJoin(subjects, eq(courses.subjectId, subjects.id))
        .leftJoin(users, eq(sections.primaryInstructorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(sections.createdAt));

      // Filter by search query if provided
      let filteredSections = sectionsData;
      if (input.searchQuery && input.searchQuery.length > 0) {
        const query = input.searchQuery.toLowerCase();
        filteredSections = sectionsData.filter((section) => {
          const courseCode = section.courseCode?.toLowerCase() || "";
          const courseTitle = section.courseTitle?.toLowerCase() || "";
          const crn = section.crn?.toLowerCase() || "";
          return (
            courseCode.includes(query) ||
            courseTitle.includes(query) ||
            crn.includes(query)
          );
        });
      }

      // Calculate stats
      const totalSections = filteredSections.length;
      const totalEnrolled = filteredSections.reduce(
        (sum, s) => sum + (s.currentEnrollment || 0),
        0
      );
      const sectionsWithWaitlist = filteredSections.filter(
        (s) => (s.waitlistCurrent || 0) > 0
      ).length;

      // Calculate capacity utilization
      const totalCapacity = filteredSections.reduce(
        (sum, s) => sum + (s.maxEnrollment || 0),
        0
      );
      const capacityUtilization =
        totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0;

      return {
        sections: filteredSections.map((section) => ({
          id: section.id,
          crn: section.crn,
          courseCode: section.courseCode || `${section.subjectCode} ${section.courseNumber}`,
          courseTitle: section.courseTitle,
          sectionNumber: section.sectionNumber,
          enrolled: section.currentEnrollment || 0,
          maxEnrollment: section.maxEnrollment || 0,
          waitlist: section.waitlistCurrent || 0,
          instructor: section.instructorFirstName && section.instructorLastName
            ? `${section.instructorFirstName} ${section.instructorLastName}`
            : "TBA",
          status: section.status,
          instructionalMethod: section.instructionalMethod,
        })),
        stats: {
          totalEnrolled,
          totalSections,
          sectionsWithWaitlist,
          capacityUtilization: Math.round(capacityUtilization * 10) / 10,
        },
      };
    }),

  // ============================================================================
  // TERM MANAGEMENT
  // ============================================================================

  /**
   * Get a single term with all details and sessions
   */
  getTermById: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({ termId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const term = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.id, input.termId),
          eq(terms.institutionId, ctx.user!.institutionId)
        ),
        with: {
          academicYear: true,
          sessions: {
            where: eq(termSessions.isActive, true),
            orderBy: (sessions, { asc }) => [asc(sessions.sortOrder)],
          },
        },
      });

      if (!term) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      return term;
    }),

  /**
   * Create a new term
   */
  createTerm: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        code: z.string().min(2).max(20),
        name: z.string().min(2).max(100),
        shortName: z.string().max(20).optional(),
        termType: z.enum(["fall", "spring", "summer", "winter", "quarter"]),
        academicYearId: z.string().uuid().optional(),
        startDate: z.string(), // ISO date
        endDate: z.string(),
        censusDate: z.string().optional(),
        registrationStartDate: z.string().optional(),
        registrationEndDate: z.string().optional(),
        addDeadline: z.string().optional(),
        dropDeadline: z.string().optional(),
        withdrawalDeadline: z.string().optional(),
        midtermGradesDue: z.string().optional(),
        finalGradesDue: z.string().optional(),
        tuitionDueDate: z.string().optional(),
        refundDeadline100: z.string().optional(),
        refundDeadline75: z.string().optional(),
        refundDeadline50: z.string().optional(),
        refundDeadline25: z.string().optional(),
        aidDisbursementDate: z.string().optional(),
        isVisible: z.boolean().default(true),
        allowRegistration: z.boolean().default(false),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate code
      const existing = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.institutionId, ctx.user!.institutionId),
          eq(terms.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Term with code "${input.code}" already exists`,
        });
      }

      const [newTerm] = await ctx.db
        .insert(terms)
        .values({
          institutionId: ctx.user!.institutionId,
          code: input.code,
          name: input.name,
          shortName: input.shortName,
          termType: input.termType,
          academicYearId: input.academicYearId,
          startDate: input.startDate,
          endDate: input.endDate,
          censusDate: input.censusDate,
          registrationStartDate: input.registrationStartDate,
          registrationEndDate: input.registrationEndDate,
          addDeadline: input.addDeadline,
          dropDeadline: input.dropDeadline,
          withdrawalDeadline: input.withdrawalDeadline,
          midtermGradesDue: input.midtermGradesDue,
          finalGradesDue: input.finalGradesDue,
          tuitionDueDate: input.tuitionDueDate,
          refundDeadline100: input.refundDeadline100,
          refundDeadline75: input.refundDeadline75,
          refundDeadline50: input.refundDeadline50,
          refundDeadline25: input.refundDeadline25,
          aidDisbursementDate: input.aidDisbursementDate,
          isVisible: input.isVisible,
          allowRegistration: input.allowRegistration,
          sortOrder: input.sortOrder ?? 0,
          isCurrent: false,
          isActive: true,
        })
        .returning();

      return newTerm;
    }),

  /**
   * Update an existing term
   */
  updateTerm: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        termId: z.string().uuid(),
        code: z.string().min(2).max(20).optional(),
        name: z.string().min(2).max(100).optional(),
        shortName: z.string().max(20).optional().nullable(),
        termType: z.enum(["fall", "spring", "summer", "winter", "quarter"]).optional(),
        academicYearId: z.string().uuid().optional().nullable(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        censusDate: z.string().optional().nullable(),
        registrationStartDate: z.string().optional().nullable(),
        registrationEndDate: z.string().optional().nullable(),
        addDeadline: z.string().optional().nullable(),
        dropDeadline: z.string().optional().nullable(),
        withdrawalDeadline: z.string().optional().nullable(),
        midtermGradesDue: z.string().optional().nullable(),
        finalGradesDue: z.string().optional().nullable(),
        tuitionDueDate: z.string().optional().nullable(),
        refundDeadline100: z.string().optional().nullable(),
        refundDeadline75: z.string().optional().nullable(),
        refundDeadline50: z.string().optional().nullable(),
        refundDeadline25: z.string().optional().nullable(),
        aidDisbursementDate: z.string().optional().nullable(),
        isVisible: z.boolean().optional(),
        allowRegistration: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { termId, ...updates } = input;

      // Verify term exists and belongs to institution
      const existing = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.id, termId),
          eq(terms.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      // Check for code conflict if changing code
      if (updates.code && updates.code !== existing.code) {
        const codeConflict = await ctx.db.query.terms.findFirst({
          where: and(
            eq(terms.institutionId, ctx.user!.institutionId),
            eq(terms.code, updates.code)
          ),
        });

        if (codeConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Term with code "${updates.code}" already exists`,
          });
        }
      }

      const [updatedTerm] = await ctx.db
        .update(terms)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(terms.id, termId))
        .returning();

      return updatedTerm;
    }),

  /**
   * Set a term as the current term (and unset others)
   */
  setCurrentTerm: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({ termId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify term exists
      const term = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.id, input.termId),
          eq(terms.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!term) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      // Unset current on all terms for this institution
      await ctx.db
        .update(terms)
        .set({ isCurrent: false })
        .where(eq(terms.institutionId, ctx.user!.institutionId));

      // Set current on the selected term
      const [updatedTerm] = await ctx.db
        .update(terms)
        .set({ isCurrent: true, updatedAt: new Date() })
        .where(eq(terms.id, input.termId))
        .returning();

      return updatedTerm;
    }),

  /**
   * Toggle registration on/off for a term
   */
  toggleRegistration: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z.object({
        termId: z.string().uuid(),
        allowRegistration: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedTerm] = await ctx.db
        .update(terms)
        .set({
          allowRegistration: input.allowRegistration,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(terms.id, input.termId),
            eq(terms.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!updatedTerm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      return updatedTerm;
    }),

  /**
   * Delete a term (soft delete by setting isActive = false)
   */
  deleteTerm: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({ termId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if term has any registrations
      const [registrationCount] = await ctx.db
        .select({ count: count() })
        .from(registrations)
        .where(eq(registrations.termId, input.termId));

      if ((registrationCount?.count ?? 0) > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete term with existing registrations. Archive it instead.",
        });
      }

      const [deletedTerm] = await ctx.db
        .update(terms)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(terms.id, input.termId),
            eq(terms.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!deletedTerm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      return { success: true, termId: input.termId };
    }),

  // ============================================================================
  // TERM SESSIONS (Part-of-Term)
  // ============================================================================

  /**
   * Get sessions for a term
   */
  getTermSessions: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(z.object({ termId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db.query.termSessions.findMany({
        where: and(
          eq(termSessions.termId, input.termId),
          eq(termSessions.institutionId, ctx.user!.institutionId),
          eq(termSessions.isActive, true)
        ),
        orderBy: (sessions, { asc }) => [asc(sessions.sortOrder)],
      });

      return sessions;
    }),

  /**
   * Create a new session within a term
   */
  createSession: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        termId: z.string().uuid(),
        code: z.string().min(2).max(20),
        name: z.string().min(2).max(100),
        startDate: z.string(),
        endDate: z.string(),
        censusDate: z.string().optional(),
        addDeadline: z.string().optional(),
        dropDeadline: z.string().optional(),
        withdrawalDeadline: z.string().optional(),
        refundDeadline100: z.string().optional(),
        refundDeadline75: z.string().optional(),
        refundDeadline50: z.string().optional(),
        refundDeadline25: z.string().optional(),
        aidDisbursementDate: z.string().optional(),
        isDefault: z.boolean().default(false),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { termId, ...sessionData } = input;

      // Verify term exists and belongs to institution
      const term = await ctx.db.query.terms.findFirst({
        where: and(
          eq(terms.id, termId),
          eq(terms.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!term) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Term not found",
        });
      }

      // Check for duplicate code within term
      const existing = await ctx.db.query.termSessions.findFirst({
        where: and(
          eq(termSessions.termId, termId),
          eq(termSessions.code, sessionData.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Session with code "${sessionData.code}" already exists in this term`,
        });
      }

      // If setting as default, unset other defaults
      if (sessionData.isDefault) {
        await ctx.db
          .update(termSessions)
          .set({ isDefault: false })
          .where(eq(termSessions.termId, termId));
      }

      const [newSession] = await ctx.db
        .insert(termSessions)
        .values({
          institutionId: ctx.user!.institutionId,
          termId,
          ...sessionData,
          sortOrder: sessionData.sortOrder ?? 0,
          isActive: true,
        })
        .returning();

      return newSession;
    }),

  /**
   * Update a session
   */
  updateSession: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        sessionId: z.string().uuid(),
        code: z.string().min(2).max(20).optional(),
        name: z.string().min(2).max(100).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        censusDate: z.string().optional().nullable(),
        addDeadline: z.string().optional().nullable(),
        dropDeadline: z.string().optional().nullable(),
        withdrawalDeadline: z.string().optional().nullable(),
        refundDeadline100: z.string().optional().nullable(),
        refundDeadline75: z.string().optional().nullable(),
        refundDeadline50: z.string().optional().nullable(),
        refundDeadline25: z.string().optional().nullable(),
        aidDisbursementDate: z.string().optional().nullable(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, ...updates } = input;

      // Verify session exists and belongs to institution
      const existing = await ctx.db.query.termSessions.findFirst({
        where: and(
          eq(termSessions.id, sessionId),
          eq(termSessions.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // If setting as default, unset other defaults
      if (updates.isDefault) {
        await ctx.db
          .update(termSessions)
          .set({ isDefault: false })
          .where(eq(termSessions.termId, existing.termId));
      }

      const [updatedSession] = await ctx.db
        .update(termSessions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(termSessions.id, sessionId))
        .returning();

      return updatedSession;
    }),

  /**
   * Delete a session (soft delete)
   */
  deleteSession: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deletedSession] = await ctx.db
        .update(termSessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(termSessions.id, input.sessionId),
            eq(termSessions.institutionId, ctx.user!.institutionId)
          )
        )
        .returning();

      if (!deletedSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return { success: true, sessionId: input.sessionId };
    }),

  // ============================================================================
  // ACADEMIC YEARS
  // ============================================================================

  /**
   * Get academic years
   */
  getAcademicYears: protectedProcedure
    .use(requireRole("ADMIN", "REGISTRAR"))
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(academicYears.institutionId, ctx.user!.institutionId)];

      if (!input?.includeInactive) {
        filters.push(eq(academicYears.isActive, true));
      }

      const years = await ctx.db.query.academicYears.findMany({
        where: and(...filters),
        orderBy: (ay, { desc }) => [desc(ay.startDate)],
      });

      return years;
    }),

  /**
   * Create academic year
   */
  createAcademicYear: protectedProcedure
    .use(requireRole("ADMIN"))
    .input(
      z.object({
        code: z.string().min(2).max(20),
        name: z.string().min(2).max(100),
        startDate: z.string(),
        endDate: z.string(),
        aidYearCode: z.string().max(10).optional(),
        isCurrent: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate code
      const existing = await ctx.db.query.academicYears.findFirst({
        where: and(
          eq(academicYears.institutionId, ctx.user!.institutionId),
          eq(academicYears.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Academic year with code "${input.code}" already exists`,
        });
      }

      // If setting as current, unset others
      if (input.isCurrent) {
        await ctx.db
          .update(academicYears)
          .set({ isCurrent: false })
          .where(eq(academicYears.institutionId, ctx.user!.institutionId));
      }

      const [newYear] = await ctx.db
        .insert(academicYears)
        .values({
          institutionId: ctx.user!.institutionId,
          code: input.code,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          aidYearCode: input.aidYearCode,
          isCurrent: input.isCurrent,
          isActive: true,
        })
        .returning();

      return newYear;
    }),
});
