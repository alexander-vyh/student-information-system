/**
 * Registration Control Router
 *
 * tRPC router for managing registration time tickets, priority groups,
 * and student registration appointments.
 *
 * Time Tickets (Registration Appointments):
 * - Priority registration for veterans (VA), students with disabilities (ADA)
 * - Class-standing based registration (seniors first, etc.)
 * - Credit-based priority assignments
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc.js";
import { eq, and, inArray, gte, lte, desc, asc, sql } from "drizzle-orm";
import {
  priorityGroups,
  registrationAppointments,
  students,
  terms,
  termEnrollments,
} from "@sis/db/schema";

export const registrationControlRouter = router({
  // ==========================================================================
  // PRIORITY GROUPS
  // ==========================================================================

  /**
   * List all priority groups for the institution
   */
  listPriorityGroups: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const filters = [eq(priorityGroups.institutionId, ctx.user!.institutionId)];

      if (input.activeOnly) {
        filters.push(eq(priorityGroups.isActive, true));
      }

      const groups = await ctx.db.query.priorityGroups.findMany({
        where: and(...filters),
        orderBy: (priorityGroups, { asc }) => [asc(priorityGroups.priorityLevel)],
      });

      return groups.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        description: g.description,
        priorityLevel: g.priorityLevel,
        membershipType: g.membershipType,
        membershipAttribute: g.membershipAttribute,
        minimumCredits: g.minimumCredits,
        isFederallyMandated: g.isFederallyMandated,
        isActive: g.isActive,
      }));
    }),

  /**
   * Get a single priority group by ID
   */
  getPriorityGroup: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.priorityGroups.findFirst({
        where: and(
          eq(priorityGroups.id, input.id),
          eq(priorityGroups.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!group) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Priority group not found",
        });
      }

      return group;
    }),

  /**
   * Create a new priority group
   */
  createPriorityGroup: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(30),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        priorityLevel: z.number().int().min(1).max(1000),
        membershipType: z.enum(["manual", "attribute", "credits", "standing"]).default("manual"),
        membershipAttribute: z.string().max(50).optional(),
        minimumCredits: z.number().min(0).optional(),
        isFederallyMandated: z.boolean().default(false),
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      // Check if code already exists
      const existing = await ctx.db.query.priorityGroups.findFirst({
        where: and(
          eq(priorityGroups.institutionId, ctx.user!.institutionId),
          eq(priorityGroups.code, input.code)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Priority group with code "${input.code}" already exists`,
        });
      }

      const result = await ctx.db
        .insert(priorityGroups)
        .values({
          institutionId: ctx.user!.institutionId,
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          priorityLevel: input.priorityLevel,
          membershipType: input.membershipType,
          membershipAttribute: input.membershipAttribute ?? null,
          minimumCredits: input.minimumCredits?.toString() ?? null,
          isFederallyMandated: input.isFederallyMandated,
        })
        .returning({ id: priorityGroups.id });

      return { id: result[0]!.id, message: "Priority group created successfully" };
    }),

  /**
   * Update a priority group
   */
  updatePriorityGroup: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        priorityLevel: z.number().int().min(1).max(1000).optional(),
        membershipType: z.enum(["manual", "attribute", "credits", "standing"]).optional(),
        membershipAttribute: z.string().max(50).optional(),
        minimumCredits: z.number().min(0).optional(),
        isFederallyMandated: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existing = await ctx.db.query.priorityGroups.findFirst({
        where: and(
          eq(priorityGroups.id, id),
          eq(priorityGroups.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Priority group not found",
        });
      }

      const updateData: Partial<{
        name: string;
        description: string;
        priorityLevel: number;
        membershipType: string;
        membershipAttribute: string;
        minimumCredits: string;
        isFederallyMandated: boolean;
        isActive: boolean;
        updatedAt: Date;
      }> = { updatedAt: new Date() };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.priorityLevel !== undefined) updateData.priorityLevel = updates.priorityLevel;
      if (updates.membershipType !== undefined) updateData.membershipType = updates.membershipType;
      if (updates.membershipAttribute !== undefined) updateData.membershipAttribute = updates.membershipAttribute;
      if (updates.minimumCredits !== undefined) updateData.minimumCredits = updates.minimumCredits.toString();
      if (updates.isFederallyMandated !== undefined) updateData.isFederallyMandated = updates.isFederallyMandated;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      await ctx.db
        .update(priorityGroups)
        .set(updateData)
        .where(eq(priorityGroups.id, id));

      return { message: "Priority group updated successfully" };
    }),

  /**
   * Delete (deactivate) a priority group
   */
  deletePriorityGroup: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.priorityGroups.findFirst({
        where: and(
          eq(priorityGroups.id, input.id),
          eq(priorityGroups.institutionId, ctx.user!.institutionId)
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Priority group not found",
        });
      }

      // Don't allow deactivation of federally mandated groups
      if (existing.isFederallyMandated) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot deactivate federally mandated priority group",
        });
      }

      await ctx.db
        .update(priorityGroups)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(priorityGroups.id, input.id));

      return { message: "Priority group deactivated successfully" };
    }),

  // ==========================================================================
  // REGISTRATION APPOINTMENTS
  // ==========================================================================

  /**
   * List registration appointments for a term
   */
  listAppointments: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        priorityGroupId: z.string().uuid().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(registrationAppointments.institutionId, ctx.user!.institutionId),
        eq(registrationAppointments.termId, input.termId),
      ];

      if (input.priorityGroupId) {
        filters.push(eq(registrationAppointments.priorityGroupId, input.priorityGroupId));
      }

      const appointments = await ctx.db.query.registrationAppointments.findMany({
        where: and(...filters),
        limit: input.limit,
        offset: input.offset,
        orderBy: (registrationAppointments, { asc }) => [
          asc(registrationAppointments.effectivePriorityLevel),
          asc(registrationAppointments.appointmentStart),
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
            },
          },
          priorityGroup: {
            columns: {
              code: true,
              name: true,
            },
          },
        },
      });

      return appointments.map((a) => ({
        id: a.id,
        student: a.student
          ? {
              id: a.student.id,
              studentId: a.student.studentId,
              firstName: a.student.preferredFirstName ?? a.student.legalFirstName,
              lastName: a.student.legalLastName,
              email: a.student.primaryEmail,
            }
          : null,
        priorityGroup: a.priorityGroup
          ? { code: a.priorityGroup.code, name: a.priorityGroup.name }
          : null,
        effectivePriorityLevel: a.effectivePriorityLevel,
        appointmentStart: a.appointmentStart,
        appointmentEnd: a.appointmentEnd,
        creditsEarnedAtGeneration: a.creditsEarnedAtGeneration,
        isManualOverride: a.isManualOverride,
        overrideReason: a.overrideReason,
      }));
    }),

  /**
   * Get a student's registration appointment for a term
   */
  getStudentAppointment: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR", "STUDENT"))
    .query(async ({ ctx, input }) => {
      const appointment = await ctx.db.query.registrationAppointments.findFirst({
        where: and(
          eq(registrationAppointments.studentId, input.studentId),
          eq(registrationAppointments.termId, input.termId)
        ),
        with: {
          priorityGroup: true,
          term: {
            columns: {
              name: true,
              registrationStartDate: true,
              registrationEndDate: true,
            },
          },
        },
      });

      if (!appointment) {
        return null;
      }

      return {
        id: appointment.id,
        priorityGroup: appointment.priorityGroup
          ? {
              code: appointment.priorityGroup.code,
              name: appointment.priorityGroup.name,
              isFederallyMandated: appointment.priorityGroup.isFederallyMandated,
            }
          : null,
        effectivePriorityLevel: appointment.effectivePriorityLevel,
        appointmentStart: appointment.appointmentStart,
        appointmentEnd: appointment.appointmentEnd,
        creditsEarnedAtGeneration: appointment.creditsEarnedAtGeneration,
        isManualOverride: appointment.isManualOverride,
        term: appointment.term
          ? {
              name: appointment.term.name,
              registrationStartDate: appointment.term.registrationStartDate,
              registrationEndDate: appointment.term.registrationEndDate,
            }
          : null,
      };
    }),

  /**
   * Create/update a manual appointment override
   */
  setManualAppointment: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
        priorityGroupId: z.string().uuid().optional(),
        effectivePriorityLevel: z.number().int().min(1).max(1000),
        appointmentStart: z.string().datetime(),
        appointmentEnd: z.string().datetime().optional(),
        overrideReason: z.string().min(1),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR"))
    .mutation(async ({ ctx, input }) => {
      // Verify student exists and belongs to institution
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

      // Check if appointment already exists
      const existing = await ctx.db.query.registrationAppointments.findFirst({
        where: and(
          eq(registrationAppointments.studentId, input.studentId),
          eq(registrationAppointments.termId, input.termId)
        ),
      });

      if (existing) {
        // Update existing appointment
        await ctx.db
          .update(registrationAppointments)
          .set({
            priorityGroupId: input.priorityGroupId ?? null,
            effectivePriorityLevel: input.effectivePriorityLevel,
            appointmentStart: new Date(input.appointmentStart),
            appointmentEnd: input.appointmentEnd ? new Date(input.appointmentEnd) : null,
            isManualOverride: true,
            overrideReason: input.overrideReason,
            updatedAt: new Date(),
          })
          .where(eq(registrationAppointments.id, existing.id));

        return { id: existing.id, message: "Appointment updated successfully" };
      } else {
        // Create new appointment
        const result = await ctx.db
          .insert(registrationAppointments)
          .values({
            institutionId: ctx.user!.institutionId,
            studentId: input.studentId,
            termId: input.termId,
            priorityGroupId: input.priorityGroupId ?? null,
            effectivePriorityLevel: input.effectivePriorityLevel,
            appointmentStart: new Date(input.appointmentStart),
            appointmentEnd: input.appointmentEnd ? new Date(input.appointmentEnd) : null,
            isManualOverride: true,
            overrideReason: input.overrideReason,
            generatedBy: ctx.user!.id,
          })
          .returning({ id: registrationAppointments.id });

        return { id: result[0]!.id, message: "Appointment created successfully" };
      }
    }),

  /**
   * Generate appointments for all eligible students in a term
   * This creates time tickets based on priority groups and credits
   */
  generateAppointments: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        registrationStartDate: z.string().datetime(),
        registrationEndDate: z.string().datetime(),
        slotDurationMinutes: z.number().int().min(15).max(1440).default(60),
        studentsPerSlot: z.number().int().min(1).max(1000).default(100),
        preserveManualOverrides: z.boolean().default(true),
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      // Verify term exists and belongs to institution
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

      // Get all active priority groups
      const groups = await ctx.db.query.priorityGroups.findMany({
        where: and(
          eq(priorityGroups.institutionId, ctx.user!.institutionId),
          eq(priorityGroups.isActive, true)
        ),
        orderBy: (priorityGroups, { asc }) => [asc(priorityGroups.priorityLevel)],
      });

      // Get all students (simplified - in production would filter by active enrollments)
      const allStudents = await ctx.db.query.students.findMany({
        where: eq(students.institutionId, ctx.user!.institutionId),
        columns: {
          id: true,
          veteranStatus: true,
          // Note: hasDisabilityAccommodation would need to be added to student schema
          // or tracked via a separate accommodations table
        },
      });

      // Get term enrollments for credit info
      const enrollments = await ctx.db.query.termEnrollments.findMany({
        where: eq(termEnrollments.termId, input.termId),
        columns: {
          studentId: true,
          earnedCredits: true,
        },
      });

      const creditsByStudent = new Map<string, number>();
      for (const e of enrollments) {
        if (e.earnedCredits) {
          creditsByStudent.set(e.studentId, parseFloat(e.earnedCredits));
        }
      }

      // Get existing manual overrides if preserving
      const existingOverrides = new Set<string>();
      if (input.preserveManualOverrides) {
        const overrides = await ctx.db.query.registrationAppointments.findMany({
          where: and(
            eq(registrationAppointments.termId, input.termId),
            eq(registrationAppointments.isManualOverride, true)
          ),
          columns: { studentId: true },
        });
        for (const o of overrides) {
          existingOverrides.add(o.studentId);
        }
      }

      // Assign priority levels to students
      interface StudentPriority {
        studentId: string;
        priorityLevel: number;
        priorityGroupId: string | null;
        creditsEarned: number;
      }

      const studentPriorities: StudentPriority[] = [];

      for (const student of allStudents) {
        // Skip students with manual overrides
        if (existingOverrides.has(student.id)) {
          continue;
        }

        const credits = creditsByStudent.get(student.id) ?? 0;
        let bestPriority = 1000; // Default lowest priority
        let bestGroupId: string | null = null;

        for (const group of groups) {
          let matches = false;

          switch (group.membershipType) {
            case "attribute":
              // Check veteran status (veteranStatus field maps to isVeteran attribute)
              if (group.membershipAttribute === "isVeteran" && student.veteranStatus) {
                matches = true;
              }
              // Note: hasDisabilityAccommodation would require checking an accommodations table
              // For now, skip disability checks - would need schema extension
              break;

            case "credits":
              if (group.minimumCredits && credits >= parseFloat(group.minimumCredits)) {
                matches = true;
              }
              break;

            case "manual":
              // Manual groups require explicit assignment - skip for auto-generation
              break;

            case "standing":
              // Would check academic standing - simplified for now
              break;
          }

          if (matches && group.priorityLevel < bestPriority) {
            bestPriority = group.priorityLevel;
            bestGroupId = group.id;
          }
        }

        // Use credit-based priority as fallback (seniors first)
        if (bestGroupId === null) {
          if (credits >= 90) bestPriority = 500; // Senior
          else if (credits >= 60) bestPriority = 600; // Junior
          else if (credits >= 30) bestPriority = 700; // Sophomore
          else bestPriority = 800; // Freshman
        }

        studentPriorities.push({
          studentId: student.id,
          priorityLevel: bestPriority,
          priorityGroupId: bestGroupId,
          creditsEarned: credits,
        });
      }

      // Sort by priority level, then by credits descending
      studentPriorities.sort((a, b) => {
        if (a.priorityLevel !== b.priorityLevel) {
          return a.priorityLevel - b.priorityLevel;
        }
        return b.creditsEarned - a.creditsEarned;
      });

      // Generate time slots
      const startTime = new Date(input.registrationStartDate);
      const endTime = new Date(input.registrationEndDate);
      const slotDurationMs = input.slotDurationMinutes * 60 * 1000;

      // Delete existing non-manual appointments
      if (!input.preserveManualOverrides) {
        await ctx.db
          .delete(registrationAppointments)
          .where(eq(registrationAppointments.termId, input.termId));
      } else {
        await ctx.db
          .delete(registrationAppointments)
          .where(
            and(
              eq(registrationAppointments.termId, input.termId),
              eq(registrationAppointments.isManualOverride, false)
            )
          );
      }

      // Assign students to slots
      const appointmentsToCreate: Array<{
        institutionId: string;
        studentId: string;
        termId: string;
        priorityGroupId: string | null;
        effectivePriorityLevel: number;
        appointmentStart: Date;
        appointmentEnd: Date;
        creditsEarnedAtGeneration: string | null;
        generatedBy: string;
        isManualOverride: boolean;
      }> = [];

      let currentSlotStart = new Date(startTime);
      let studentsInCurrentSlot = 0;

      for (const sp of studentPriorities) {
        if (currentSlotStart >= endTime) {
          // No more slots available
          break;
        }

        const slotEnd = new Date(Math.min(currentSlotStart.getTime() + slotDurationMs, endTime.getTime()));

        appointmentsToCreate.push({
          institutionId: ctx.user!.institutionId,
          studentId: sp.studentId,
          termId: input.termId,
          priorityGroupId: sp.priorityGroupId,
          effectivePriorityLevel: sp.priorityLevel,
          appointmentStart: currentSlotStart,
          appointmentEnd: slotEnd,
          creditsEarnedAtGeneration: sp.creditsEarned.toString(),
          generatedBy: ctx.user!.id,
          isManualOverride: false,
        });

        studentsInCurrentSlot++;
        if (studentsInCurrentSlot >= input.studentsPerSlot) {
          currentSlotStart = new Date(currentSlotStart.getTime() + slotDurationMs);
          studentsInCurrentSlot = 0;
        }
      }

      // Batch insert appointments
      if (appointmentsToCreate.length > 0) {
        // Insert in chunks to avoid query size limits
        const chunkSize = 100;
        for (let i = 0; i < appointmentsToCreate.length; i += chunkSize) {
          const chunk = appointmentsToCreate.slice(i, i + chunkSize);
          await ctx.db.insert(registrationAppointments).values(chunk);
        }
      }

      return {
        generated: appointmentsToCreate.length,
        preserved: existingOverrides.size,
        message: `Generated ${appointmentsToCreate.length} appointments`,
      };
    }),

  /**
   * Delete all appointments for a term (except manual overrides)
   */
  clearAppointments: protectedProcedure
    .input(
      z.object({
        termId: z.string().uuid(),
        includeManualOverrides: z.boolean().default(false),
      })
    )
    .use(requireRole("ADMIN"))
    .mutation(async ({ ctx, input }) => {
      const filters = [
        eq(registrationAppointments.termId, input.termId),
        eq(registrationAppointments.institutionId, ctx.user!.institutionId),
      ];

      if (!input.includeManualOverrides) {
        filters.push(eq(registrationAppointments.isManualOverride, false));
      }

      const result = await ctx.db
        .delete(registrationAppointments)
        .where(and(...filters))
        .returning({ id: registrationAppointments.id });

      return {
        deleted: result.length,
        message: `Deleted ${result.length} appointments`,
      };
    }),

  /**
   * Check if a student can register now
   */
  canRegisterNow: protectedProcedure
    .input(
      z.object({
        studentId: z.string().uuid(),
        termId: z.string().uuid(),
      })
    )
    .use(requireRole("ADMIN", "REGISTRAR", "ADVISOR", "STUDENT"))
    .query(async ({ ctx, input }) => {
      const now = new Date();

      // Get the term to check if registration is open
      const term = await ctx.db.query.terms.findFirst({
        where: eq(terms.id, input.termId),
        columns: {
          allowRegistration: true,
          registrationStartDate: true,
          registrationEndDate: true,
        },
      });

      if (!term) {
        return { canRegister: false, reason: "Term not found" };
      }

      if (!term.allowRegistration) {
        return { canRegister: false, reason: "Registration is not open for this term" };
      }

      // Check student's appointment
      const appointment = await ctx.db.query.registrationAppointments.findFirst({
        where: and(
          eq(registrationAppointments.studentId, input.studentId),
          eq(registrationAppointments.termId, input.termId)
        ),
      });

      if (!appointment) {
        // No appointment - check if term registration is open to all
        if (term.registrationEndDate && new Date(term.registrationEndDate) < now) {
          return { canRegister: false, reason: "Registration period has ended" };
        }
        // Allow if no appointment system or after general open date
        return { canRegister: true, reason: "Open registration" };
      }

      // Check appointment window
      if (appointment.appointmentStart > now) {
        return {
          canRegister: false,
          reason: "Registration appointment has not started yet",
          appointmentStart: appointment.appointmentStart,
        };
      }

      if (appointment.appointmentEnd && appointment.appointmentEnd < now) {
        // Past appointment window - might still be within term registration period
        if (term.registrationEndDate && new Date(term.registrationEndDate) >= now) {
          return { canRegister: true, reason: "Past appointment window, open registration" };
        }
        return { canRegister: false, reason: "Registration period has ended" };
      }

      return { canRegister: true, reason: "Within appointment window" };
    }),

  /**
   * Get appointment summary statistics for a term
   */
  getAppointmentStats: protectedProcedure
    .input(z.object({ termId: z.string().uuid() }))
    .use(requireRole("ADMIN", "REGISTRAR"))
    .query(async ({ ctx, input }) => {
      const appointments = await ctx.db.query.registrationAppointments.findMany({
        where: and(
          eq(registrationAppointments.termId, input.termId),
          eq(registrationAppointments.institutionId, ctx.user!.institutionId)
        ),
        with: {
          priorityGroup: {
            columns: { code: true, name: true },
          },
        },
      });

      const totalCount = appointments.length;
      const manualOverrideCount = appointments.filter((a) => a.isManualOverride).length;

      // Group by priority group
      const byPriorityGroup = appointments.reduce(
        (acc, a) => {
          const key = a.priorityGroup?.code ?? "None";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Group by priority level
      const byPriorityLevel = appointments.reduce(
        (acc, a) => {
          const level = a.effectivePriorityLevel.toString();
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Find earliest and latest appointments
      const sortedByTime = [...appointments].sort(
        (a, b) => a.appointmentStart.getTime() - b.appointmentStart.getTime()
      );

      return {
        totalAppointments: totalCount,
        manualOverrides: manualOverrideCount,
        byPriorityGroup,
        byPriorityLevel,
        earliestAppointment: sortedByTime[0]?.appointmentStart ?? null,
        latestAppointment: sortedByTime[sortedByTime.length - 1]?.appointmentStart ?? null,
      };
    }),
});
