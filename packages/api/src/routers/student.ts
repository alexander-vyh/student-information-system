/**
 * Student Router
 *
 * tRPC router for student-related operations.
 */

import { z } from "zod";
import {
  router,
  protectedProcedure,
  canAccessStudent,
} from "../trpc.js";
import { eq, and, inArray, isNull, or, ilike, sql } from "drizzle-orm";
import {
  students,
  studentAddresses,
  studentGpaSummary,
  registrations,
  registrationHolds,
} from "@sis/db/schema";

export const studentRouter = router({
  /**
   * Get current user's student profile
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.studentId) {
      return null;
    }

    const student = await ctx.db.query.students.findFirst({
      where: eq(students.id, ctx.user.studentId),
    });

    return student;
  }),

  /**
   * Get student by ID (requires appropriate permissions)
   */
  getById: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
      });

      if (!student) {
        return null;
      }

      // Mask sensitive fields based on role
      if (!ctx.user?.roles.includes("ADMIN") && !ctx.user?.roles.includes("REGISTRAR")) {
        return {
          ...student,
          ssnEncrypted: undefined,
          ssnLast4: student.ssnLast4 ? `***-**-${student.ssnLast4}` : null,
        };
      }

      return student;
    }),

  /**
   * Search students (staff only)
   */
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user has search permission
      const searchRoles = ["ADMIN", "REGISTRAR", "FINANCIAL_AID", "BURSAR", "ADVISOR"];
      if (!searchRoles.some((role) => ctx.user?.roles.includes(role))) {
        return { students: [], total: 0 };
      }

      // Search across name, email, and student ID using case-insensitive matching
      const searchPattern = `%${input.query}%`;

      const results = await ctx.db.query.students.findMany({
        where: and(
          eq(students.institutionId, ctx.user!.institutionId),
          or(
            ilike(students.legalFirstName, searchPattern),
            ilike(students.legalLastName, searchPattern),
            ilike(students.preferredFirstName, searchPattern),
            ilike(students.primaryEmail, searchPattern),
            ilike(students.studentId, searchPattern),
            // Also search "firstName lastName" combined
            sql`CONCAT(${students.legalFirstName}, ' ', ${students.legalLastName}) ILIKE ${searchPattern}`
          )
        ),
        limit: input.limit,
        offset: input.offset,
        columns: {
          id: true,
          studentId: true,
          legalFirstName: true,
          legalLastName: true,
          preferredFirstName: true,
          primaryEmail: true,
          status: true,
        },
      });

      return {
        students: results,
        total: results.length, // Would need COUNT query for actual total
      };
    }),

  /**
   * Get student with detailed information (GPA, enrollments, holds)
   */
  getWithDetails: protectedProcedure
    .input(z.object({ studentId: z.string().uuid() }))
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .query(async ({ ctx, input }) => {
      // Get student basic info
      const student = await ctx.db.query.students.findFirst({
        where: eq(students.id, input.studentId),
      });

      if (!student) {
        return null;
      }

      // Get GPA summary
      const gpaSummary = await ctx.db.query.studentGpaSummary.findFirst({
        where: eq(studentGpaSummary.studentId, input.studentId),
      });

      // Get current enrollments (registered status only)
      const currentEnrollments = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.studentId, input.studentId),
          eq(registrations.status, "registered")
        ),
        with: {
          section: {
            with: {
              course: true,
            },
          },
          term: true,
        },
        orderBy: (registrations, { desc }) => [desc(registrations.registrationDate)],
        limit: 10,
      });

      // Get active holds (not resolved)
      const activeHolds = await ctx.db.query.registrationHolds.findMany({
        where: and(
          eq(registrationHolds.studentId, input.studentId),
          isNull(registrationHolds.resolvedAt)
        ),
        orderBy: (registrationHolds, { desc }) => [desc(registrationHolds.effectiveFrom)],
      });

      // Mask sensitive fields based on role
      const isPrivileged =
        ctx.user?.roles.includes("ADMIN") ||
        ctx.user?.roles.includes("REGISTRAR");

      const sanitizedStudent = isPrivileged
        ? student
        : {
            ...student,
            ssnEncrypted: undefined,
            ssnLast4: student.ssnLast4 ? `***-**-${student.ssnLast4}` : null,
          };

      return {
        student: sanitizedStudent,
        gpaSummary: gpaSummary
          ? {
              cumulativeGpa: gpaSummary.cumulativeGpa,
              cumulativeEarnedCredits: gpaSummary.cumulativeEarnedCredits,
              cumulativeAttemptedCredits: gpaSummary.cumulativeAttemptedCredits,
              inProgressCredits: gpaSummary.inProgressCredits,
              transferCredits: gpaSummary.transferCredits,
              lastTermGpa: gpaSummary.lastTermGpa,
            }
          : null,
        currentEnrollments: currentEnrollments.map((reg) => ({
          registrationId: reg.id,
          courseCode: reg.section?.course?.courseCode ?? "Unknown",
          courseTitle: reg.section?.course?.title ?? "Unknown",
          sectionNumber: reg.section?.sectionNumber,
          creditHours: reg.creditHours,
          gradeMode: reg.gradeMode,
          termName: reg.term?.name ?? "Unknown Term",
          registeredAt: reg.registrationDate,
        })),
        activeHolds: activeHolds.map((hold) => ({
          id: hold.id,
          holdType: hold.holdType,
          holdName: hold.holdName,
          description: hold.description,
          blocksRegistration: hold.blocksRegistration,
          blocksGrades: hold.blocksGrades,
          blocksTranscript: hold.blocksTranscript,
          blocksDiploma: hold.blocksDiploma,
          effectiveFrom: hold.effectiveFrom,
        })),
      };
    }),

  /**
   * Update student address
   */
  updateAddress: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        addressId: z.string().uuid().optional(),
        addressType: z.enum(["permanent", "mailing", "local", "billing"]),
        address1: z.string().min(1).max(100),
        address2: z.string().max(100).optional(),
        city: z.string().min(1).max(100),
        state: z.string().max(50).optional(),
        postalCode: z.string().max(20).optional(),
        country: z.string().length(2).default("US"),
        isPrimary: z.boolean().default(false),
      })
    )
    .use(canAccessStudent((input) => (input as { studentId: string }).studentId))
    .mutation(async ({ ctx, input }) => {
      const { studentId, addressId, ...addressData } = input;

      if (addressId) {
        // Update existing address
        const [updated] = await ctx.db
          .update(studentAddresses)
          .set({
            ...addressData,
            updatedAt: new Date(),
          })
          .where(eq(studentAddresses.id, addressId))
          .returning();

        return updated;
      } else {
        // Create new address
        const [created] = await ctx.db
          .insert(studentAddresses)
          .values({
            studentId,
            ...addressData,
          })
          .returning();

        return created;
      }
    }),
});
