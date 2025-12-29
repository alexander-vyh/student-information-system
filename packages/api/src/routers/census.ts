/**
 * Census Router
 *
 * tRPC router for managing census date snapshots and enrollment reporting.
 * Supports IPEDS, NSC (National Student Clearinghouse), and other reporting requirements.
 *
 * Census snapshots capture point-in-time enrollment data for:
 * - IPEDS reporting (Fall/Spring enrollment)
 * - NSC enrollment reporting
 * - Title IV R2T4 processing
 * - Internal enrollment analytics
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import { eq, and, desc } from "drizzle-orm";
import {
  censusSnapshots,
  censusSnapshotDetails,
  terms,
  registrations,
  termEnrollments,
  type CensusDemographics,
} from "@sis/db/schema";

export const censusRouter = router({
  // ==========================================================================
  // CENSUS SNAPSHOTS
  // ==========================================================================

  /**
   * List census snapshots for a term
   */
  listSnapshots: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        sessionId: z.string().uuid().optional(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(censusSnapshots.institutionId, ctx.user!.institutionId),
        eq(censusSnapshots.termId, input.termId),
      ];

      if (input.sessionId) {
        filters.push(eq(censusSnapshots.sessionId, input.sessionId));
      }

      const snapshots = await ctx.db.query.censusSnapshots.findMany({
        where: and(...filters),
        orderBy: (censusSnapshots, { desc }) => [desc(censusSnapshots.snapshotDate)],
        with: {
          session: {
            columns: { code: true, name: true },
          },
          generatedByUser: {
            columns: { email: true },
          },
        },
      });

      return snapshots.map((s) => ({
        id: s.id,
        snapshotDate: s.snapshotDate,
        snapshotType: s.snapshotType,
        session: s.session ? { code: s.session.code, name: s.session.name } : null,
        totalHeadcount: s.totalHeadcount,
        fullTimeCount: s.fullTimeCount,
        partTimeCount: s.partTimeCount,
        totalFte: s.totalFte,
        totalCreditHours: s.totalCreditHours,
        status: s.status,
        generatedAt: s.generatedAt,
        generatedBy: s.generatedByUser?.email ?? null,
        nscFileGeneratedAt: s.nscFileGeneratedAt,
        nscFileName: s.nscFileName,
      }));
    }),

  /**
   * Get a single census snapshot with full details
   */
  getSnapshot: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const snapshot = await ctx.db.query.censusSnapshots.findFirst({
        where: and(
          eq(censusSnapshots.id, input.id),
          eq(censusSnapshots.institutionId, ctx.user!.institutionId)
        ),
        with: {
          term: {
            columns: { code: true, name: true },
          },
          session: {
            columns: { code: true, name: true },
          },
          generatedByUser: {
            columns: { email: true },
          },
        },
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Census snapshot not found",
        });
      }

      return {
        id: snapshot.id,
        term: snapshot.term ? { code: snapshot.term.code, name: snapshot.term.name } : null,
        session: snapshot.session
          ? { code: snapshot.session.code, name: snapshot.session.name }
          : null,
        snapshotDate: snapshot.snapshotDate,
        snapshotType: snapshot.snapshotType,
        totalHeadcount: snapshot.totalHeadcount,
        fullTimeCount: snapshot.fullTimeCount,
        partTimeCount: snapshot.partTimeCount,
        halfTimeCount: snapshot.halfTimeCount,
        lessThanHalfTimeCount: snapshot.lessThanHalfTimeCount,
        totalFte: snapshot.totalFte,
        undergraduateFte: snapshot.undergraduateFte,
        graduateFte: snapshot.graduateFte,
        totalCreditHours: snapshot.totalCreditHours,
        demographicsBreakdown: snapshot.demographicsBreakdown,
        status: snapshot.status,
        generatedAt: snapshot.generatedAt,
        generatedBy: snapshot.generatedByUser?.email ?? null,
        nscFileGeneratedAt: snapshot.nscFileGeneratedAt,
        nscFileName: snapshot.nscFileName,
      };
    }),

  /**
   * Generate a new census snapshot
   */
  generateSnapshot: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        sessionId: z.string().uuid().optional(),
        snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        snapshotType: z.enum(["census", "midterm", "final", "custom"]).default("census"),
        fullTimeCreditsThreshold: z.number().min(1).default(12),
        halfTimeCreditsThreshold: z.number().min(1).default(6),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
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

      // Get all active registrations for this term
      const allRegistrations = await ctx.db.query.registrations.findMany({
        where: and(
          eq(registrations.termId, input.termId),
          eq(registrations.status, "registered")
        ),
      });

      // Get student info separately
      const studentIds = [...new Set(allRegistrations.map((r) => r.studentId))];
      const studentsData = await ctx.db.query.students.findMany({
        where: (students, { inArray }) => inArray(students.id, studentIds),
        columns: {
          id: true,
          institutionId: true,
          gender: true,
          hispanicLatino: true,
          races: true,
          dateOfBirth: true,
          citizenshipStatus: true,
        },
        with: {
          programs: {
            columns: {
              id: true,
              status: true,
            },
            where: (programs, { eq }) => eq(programs.status, "active"),
          },
        },
      });

      const studentMap = new Map(studentsData.map((s) => [s.id, s]));

      // Filter to this institution and aggregate by student
      type StudentData = typeof studentsData[0];
      const studentCredits = new Map<
        string,
        {
          credits: number;
          student: StudentData | undefined;
        }
      >();

      for (const reg of allRegistrations) {
        const student = studentMap.get(reg.studentId);
        if (student?.institutionId !== ctx.user!.institutionId) continue;

        const existing = studentCredits.get(reg.studentId);
        const credits = parseFloat(reg.creditHours);

        if (existing) {
          existing.credits += credits;
        } else {
          studentCredits.set(reg.studentId, {
            credits,
            student,
          });
        }
      }

      // Calculate enrollment statistics
      let fullTimeCount = 0;
      let partTimeCount = 0;
      let halfTimeCount = 0;
      let lessThanHalfTimeCount = 0;
      let totalCredits = 0;
      let undergraduateFte = 0;
      let graduateFte = 0;

      const snapshotRecords: Array<{
        studentId: string;
        enrollmentStatus: string;
        enrollmentType: string;
        creditHours: string;
        fte: string;
        programId: string | null;
        level: string;
        gender: string | null;
        residency: string | null;
        ageAtCensus: number | null;
      }> = [];
      const demographics: CensusDemographics = {
        byGender: { male: 0, female: 0, unknown: 0 },
        byLevel: { undergraduate: 0, graduate: 0 },
        byResidency: { inState: 0, outOfState: 0, international: 0 },
      };

      for (const [studentId, data] of studentCredits) {
        const { credits, student } = data;
        totalCredits += credits;

        // Determine enrollment type
        let enrollmentType: string;
        let fte: number;

        if (credits >= input.fullTimeCreditsThreshold) {
          enrollmentType = "full_time";
          fullTimeCount++;
          fte = 1.0;
        } else if (credits >= input.halfTimeCreditsThreshold) {
          enrollmentType = "half_time";
          halfTimeCount++;
          fte = 0.5;
        } else if (credits >= input.halfTimeCreditsThreshold / 2) {
          enrollmentType = "part_time";
          partTimeCount++;
          fte = credits / input.fullTimeCreditsThreshold;
        } else {
          enrollmentType = "less_than_half_time";
          lessThanHalfTimeCount++;
          fte = credits / input.fullTimeCreditsThreshold;
        }

        // Determine level from active program
        // Note: programLevel would need to be tracked in curriculum.programs, not studentPrograms
        // For now, default to undergraduate - in production, would query program details
        const activeProgram = student?.programs?.[0];
        // Placeholder: Would determine level from program lookup
        const isGraduateLevel = false; // Would check program's level field

        if (isGraduateLevel) {
          graduateFte += fte;
          if (demographics.byLevel) demographics.byLevel.graduate++;
        } else {
          undergraduateFte += fte;
          if (demographics.byLevel) demographics.byLevel.undergraduate++;
        }
        const level = isGraduateLevel ? "graduate" : "undergraduate";

        // Demographics
        if (student?.gender && demographics.byGender) {
          if (student.gender === "male" || student.gender === "M") demographics.byGender.male++;
          else if (student.gender === "female" || student.gender === "F") demographics.byGender.female++;
          else demographics.byGender.unknown++;
        }

        // Residency based on citizenship status
        if (student?.citizenshipStatus && demographics.byResidency) {
          if (student.citizenshipStatus === "INTERNATIONAL") demographics.byResidency.international++;
          // Note: In-state vs out-of-state would require address data
          else demographics.byResidency.inState++; // Default to in-state for domestic
        }

        // Determine residency type
        let residencyType: string | null = null;
        if (student?.citizenshipStatus === "INTERNATIONAL") {
          residencyType = "international";
        } else if (student?.citizenshipStatus) {
          residencyType = "in_state"; // Default for domestic
        }

        // Calculate age at census
        let ageAtCensus: number | null = null;
        if (student?.dateOfBirth) {
          const dob = new Date(student.dateOfBirth);
          const censusDate = new Date(input.snapshotDate);
          ageAtCensus = censusDate.getFullYear() - dob.getFullYear();
          // Adjust if birthday hasn't occurred yet this year
          const monthDiff = censusDate.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && censusDate.getDate() < dob.getDate())) {
            ageAtCensus--;
          }
        }

        // Add to snapshot records
        snapshotRecords.push({
          studentId,
          enrollmentStatus: "enrolled",
          enrollmentType,
          creditHours: credits.toFixed(2),
          fte: fte.toFixed(3),
          programId: activeProgram?.id ?? null,
          level,
          gender: student?.gender ?? null,
          residency: residencyType,
          ageAtCensus,
        });
      }

      const totalFte = undergraduateFte + graduateFte;
      const totalHeadcount = studentCredits.size;

      // Create the snapshot and detail records in a transaction
      const snapshotId = await ctx.db.transaction(async (tx) => {
        // 1. Create the snapshot header
        const result = await tx
          .insert(censusSnapshots)
          .values({
            institutionId: ctx.user!.institutionId,
            termId: input.termId,
            sessionId: input.sessionId ?? null,
            snapshotDate: input.snapshotDate,
            snapshotType: input.snapshotType,
            totalHeadcount,
            fullTimeCount,
            partTimeCount: partTimeCount + halfTimeCount + lessThanHalfTimeCount,
            halfTimeCount,
            lessThanHalfTimeCount,
            totalFte: totalFte.toFixed(2),
            undergraduateFte: undergraduateFte.toFixed(2),
            graduateFte: graduateFte.toFixed(2),
            totalCreditHours: totalCredits.toFixed(2),
            demographicsBreakdown: demographics,
            generatedBy: ctx.user!.id,
            status: "draft",
          })
          .returning({ id: censusSnapshots.id });

        const newSnapshotId = result[0]!.id;

        // 2. Insert detail records into normalized table
        if (snapshotRecords.length > 0) {
          await tx.insert(censusSnapshotDetails).values(
            snapshotRecords.map((record) => ({
              snapshotId: newSnapshotId,
              studentId: record.studentId,
              enrollmentStatus: record.enrollmentStatus,
              enrollmentType: record.enrollmentType,
              creditHours: record.creditHours,
              fte: record.fte,
              programId: record.programId,
              level: record.level,
              gender: record.gender,
              residency: record.residency,
              ageAtCensus: record.ageAtCensus,
            }))
          );
        }

        return newSnapshotId;
      });

      return {
        id: snapshotId,
        totalHeadcount,
        totalFte: totalFte.toFixed(2),
        message: "Census snapshot generated successfully",
      };
    }),

  /**
   * Finalize a census snapshot
   */
  finalizeSnapshot: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.db.query.censusSnapshots.findFirst({
        where: and(
          eq(censusSnapshots.id, input.id),
          eq(censusSnapshots.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Census snapshot not found",
        });
      }

      if (snapshot.status === "finalized" || snapshot.status === "submitted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Snapshot has already been finalized",
        });
      }

      await ctx.db
        .update(censusSnapshots)
        .set({ status: "finalized", updatedAt: new Date() })
        .where(eq(censusSnapshots.id, input.id));

      return { message: "Snapshot finalized successfully" };
    }),

  /**
   * Delete a draft census snapshot
   */
  deleteSnapshot: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.db.query.censusSnapshots.findFirst({
        where: and(
          eq(censusSnapshots.id, input.id),
          eq(censusSnapshots.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Census snapshot not found",
        });
      }

      if (snapshot.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft snapshots can be deleted",
        });
      }

      await ctx.db.delete(censusSnapshots).where(eq(censusSnapshots.id, input.id));

      return { message: "Snapshot deleted successfully" };
    }),

  // ==========================================================================
  // NSC EXPORT
  // ==========================================================================

  /**
   * Generate NSC (National Student Clearinghouse) enrollment file
   * Format: Fixed-width text file for SSCR (Student Status Confirmation Report)
   */
  generateNscFile: protectedProcedure
    .input(z.object({ snapshotId: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.db.query.censusSnapshots.findFirst({
        where: and(
          eq(censusSnapshots.id, input.snapshotId),
          eq(censusSnapshots.institutionId, ctx.user!.institutionId)
        ),
        with: {
          term: true,
        },
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Census snapshot not found",
        });
      }

      if (snapshot.status === "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Snapshot must be finalized before generating NSC file",
        });
      }

      // Get institution info for file header
      const institution = await ctx.db.query.institutions.findFirst({
        where: eq(terms.institutionId, ctx.user!.institutionId),
      });

      if (!institution) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Institution not found",
        });
      }

      // Get student records from normalized table
      const snapshotDetails = await ctx.db.query.censusSnapshotDetails.findMany({
        where: eq(censusSnapshotDetails.snapshotId, input.snapshotId),
      });

      if (snapshotDetails.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Snapshot has no student records",
        });
      }

      // Get full student info for the records
      const nscStudentIds = snapshotDetails.map((d) => d.studentId);
      const nscStudentsData = await ctx.db.query.students.findMany({
        where: (students, { inArray }) => inArray(students.id, nscStudentIds),
        columns: {
          id: true,
          studentId: true,
          ssnLast4: true,
          legalFirstName: true,
          legalMiddleName: true,
          legalLastName: true,
          dateOfBirth: true,
        },
      });
      const nscStudentMap = new Map(nscStudentsData.map((s) => [s.id, s]));

      // Build NSC file content (simplified SSCR format)
      // In production, this would follow the exact NSC SSCR file specification
      const lines: string[] = [];

      // Header record
      const today = new Date();
      const fileDate = today.toISOString().slice(0, 10).replace(/-/g, "");
      const termStartDate = snapshot.term?.startDate ?? snapshot.snapshotDate;
      const termEndDate = snapshot.term?.endDate ?? snapshot.snapshotDate;

      lines.push(
        `H1${(institution.ficeCode ?? "000000").padEnd(6)}${fileDate}${snapshotDetails.length.toString().padStart(6, "0")}SSCR`
      );

      // Detail records
      for (const detail of snapshotDetails) {
        const student = nscStudentMap.get(detail.studentId);
        if (!student) continue;

        // Map enrollment type to NSC status code
        let statusCode: string;
        switch (detail.enrollmentType) {
          case "full_time":
            statusCode = "F";
            break;
          case "half_time":
            statusCode = "H";
            break;
          case "part_time":
            statusCode = "Q";
            break;
          case "less_than_half_time":
            statusCode = "L";
            break;
          default:
            statusCode = "F";
        }

        // SSN (last 4 only for this example, masked)
        const ssnLast4 = student.ssnLast4 ?? "0000";
        const ssnMasked = ssnLast4.padStart(9, "0");

        // Name fields (20 chars each)
        const firstName = (student.legalFirstName ?? "").slice(0, 20).padEnd(20);
        const middleName = (student.legalMiddleName ?? "").slice(0, 1).padEnd(1);
        const lastName = (student.legalLastName ?? "").slice(0, 20).padEnd(20);

        // Date of birth (YYYYMMDD)
        const dob = student.dateOfBirth
          ? student.dateOfBirth.replace(/-/g, "")
          : "00000000";

        // Term dates
        const startDate = termStartDate.replace(/-/g, "");
        const endDate = termEndDate.replace(/-/g, "");

        lines.push(
          `D1${ssnMasked}${firstName}${middleName}${lastName}${dob}${statusCode}${startDate}${endDate}`
        );
      }

      // Trailer record
      lines.push(
        `T1${snapshotDetails.length.toString().padStart(6, "0")}`
      );

      const fileContent = lines.join("\n");
      const fileName = `NSC_SSCR_${institution.code ?? "INST"}_${fileDate}.txt`;

      // Update snapshot with NSC file info
      await ctx.db
        .update(censusSnapshots)
        .set({
          nscFileGeneratedAt: new Date(),
          nscFileName: fileName,
          updatedAt: new Date(),
        })
        .where(eq(censusSnapshots.id, input.snapshotId));

      return {
        fileName,
        recordCount: snapshotDetails.length,
        fileContent,
        message: "NSC file generated successfully",
      };
    }),

  /**
   * Get detailed student records for a census snapshot
   */
  getSnapshotDetails: protectedProcedure
    .input(
      z.object({
        snapshotId: z.string().uuid(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      // Verify snapshot exists and belongs to this institution
      const snapshot = await ctx.db.query.censusSnapshots.findFirst({
        where: and(
          eq(censusSnapshots.id, input.snapshotId),
          eq(censusSnapshots.institutionId, ctx.user!.institutionId)
        ),
        columns: { id: true },
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Census snapshot not found",
        });
      }

      // Get paginated detail records with student info
      const details = await ctx.db.query.censusSnapshotDetails.findMany({
        where: eq(censusSnapshotDetails.snapshotId, input.snapshotId),
        limit: input.limit,
        offset: input.offset,
      });

      // Get student info for display
      const studentIds = details.map((d) => d.studentId);
      const studentsData = await ctx.db.query.students.findMany({
        where: (students, { inArray }) => inArray(students.id, studentIds),
        columns: {
          id: true,
          studentId: true,
          legalFirstName: true,
          legalLastName: true,
        },
      });
      const studentMap = new Map(studentsData.map((s) => [s.id, s]));

      // Get total count
      const allDetails = await ctx.db.query.censusSnapshotDetails.findMany({
        where: eq(censusSnapshotDetails.snapshotId, input.snapshotId),
        columns: { id: true },
      });
      const totalCount = allDetails.length;

      return {
        data: details.map((d) => {
          const student = studentMap.get(d.studentId);
          return {
            id: d.id,
            studentId: d.studentId,
            studentNumber: student?.studentId ?? null,
            studentName: student
              ? `${student.legalFirstName ?? ""} ${student.legalLastName ?? ""}`.trim()
              : null,
            enrollmentStatus: d.enrollmentStatus,
            enrollmentType: d.enrollmentType,
            creditHours: d.creditHours,
            fte: d.fte,
            level: d.level,
            programId: d.programId,
            gender: d.gender,
            residency: d.residency,
            ageAtCensus: d.ageAtCensus,
          };
        }),
        pagination: {
          total: totalCount,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + details.length < totalCount,
        },
      };
    }),

  // ==========================================================================
  // REPORTING
  // ==========================================================================

  /**
   * Get enrollment trend comparison across terms
   */
  getEnrollmentTrend: protectedProcedure
    .input(
      z.object({
        termIds: z.array(z.string().uuid()).min(1).max(10),
        snapshotType: z.enum(["census", "midterm", "final", "custom"]).default("census"),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const snapshots = await ctx.db.query.censusSnapshots.findMany({
        where: and(
          eq(censusSnapshots.institutionId, ctx.user!.institutionId),
          eq(censusSnapshots.snapshotType, input.snapshotType)
        ),
        with: {
          term: {
            columns: { code: true, name: true, startDate: true },
          },
        },
        orderBy: (censusSnapshots, { asc }) => [asc(censusSnapshots.snapshotDate)],
      });

      // Filter to requested terms and get latest snapshot per term
      const termSnapshots = new Map<
        string,
        typeof snapshots[0]
      >();

      for (const s of snapshots) {
        if (!input.termIds.includes(s.termId)) continue;

        const existing = termSnapshots.get(s.termId);
        if (!existing || s.snapshotDate > existing.snapshotDate) {
          termSnapshots.set(s.termId, s);
        }
      }

      return Array.from(termSnapshots.values())
        .sort((a, b) => {
          const aDate = a.term?.startDate ?? a.snapshotDate;
          const bDate = b.term?.startDate ?? b.snapshotDate;
          return aDate.localeCompare(bDate);
        })
        .map((s) => ({
          termId: s.termId,
          termCode: s.term?.code ?? "Unknown",
          termName: s.term?.name ?? "Unknown",
          snapshotDate: s.snapshotDate,
          headcount: s.totalHeadcount,
          fte: s.totalFte,
          fullTime: s.fullTimeCount,
          partTime: s.partTimeCount,
          creditHours: s.totalCreditHours,
        }));
    }),

  /**
   * Get current enrollment counts (real-time, not from snapshot)
   */
  getCurrentEnrollment: protectedProcedure
    .input(z.object({ termId: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      // Get term enrollments
      const enrollments = await ctx.db.query.termEnrollments.findMany({
        where: and(
          eq(termEnrollments.termId, input.termId),
          eq(termEnrollments.enrollmentStatus, "enrolled")
        ),
        with: {
          student: {
            columns: { institutionId: true },
          },
        },
      });

      // Filter to this institution
      const filtered = enrollments.filter(
        (e) => e.student?.institutionId === ctx.user!.institutionId
      );

      let fullTime = 0;
      let partTime = 0;
      let totalCredits = 0;

      for (const e of filtered) {
        const credits = parseFloat(e.registeredCredits ?? "0");
        totalCredits += credits;

        if (e.enrollmentType === "full_time") fullTime++;
        else partTime++;
      }

      return {
        headcount: filtered.length,
        fullTime,
        partTime,
        totalCredits: totalCredits.toFixed(2),
        asOf: new Date(),
      };
    }),
});
