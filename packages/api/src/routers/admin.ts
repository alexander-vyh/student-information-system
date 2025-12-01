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
  sections,
  courses,
  subjects,
  users,
} from "@sis/db/schema";

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
});
