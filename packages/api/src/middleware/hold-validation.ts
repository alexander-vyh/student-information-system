/**
 * Hold Validation Middleware
 *
 * Validates that students don't have blocking holds before performing
 * protected actions (registration, viewing grades, requesting transcripts, etc.)
 */

import { TRPCError } from "@trpc/server";
import { type Context } from "../trpc.js";
import { registrationHolds } from "@sis/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export type HoldCheckType = "registration" | "grades" | "transcript" | "diploma" | "graduation";

export interface HoldValidationOptions {
  checkType: HoldCheckType;
  studentIdGetter: (input: any) => string;
  errorMessage?: string;
  allowOverride?: boolean; // Allow admins to override hold checks
}

/**
 * Check if a student has blocking holds
 */
export async function checkStudentHolds(
  ctx: Context,
  studentId: string,
  checkType: HoldCheckType
): Promise<{
  hasBlockingHolds: boolean;
  holds: Array<{
    id: string;
    holdCode: string;
    holdName: string;
    description: string | null;
    releaseAuthority: string | null;
  }>;
}> {
  // Get all active (unresolved) holds for the student
  const holds = await ctx.db.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      isNull(registrationHolds.resolvedAt) // Only active holds
    ),
  });

  // Filter by what's blocked and check effective dates
  const now = new Date();
  const blockingHolds = holds.filter((hold) => {
    // Check if currently effective
    const effectiveFrom = hold.effectiveFrom ?? new Date(0);
    const isEffective =
      effectiveFrom <= now &&
      (hold.effectiveUntil === null || hold.effectiveUntil > now);

    if (!isEffective) return false;

    // Check the specific block type
    switch (checkType) {
      case "registration":
        return hold.blocksRegistration ?? false;
      case "grades":
        return hold.blocksGrades ?? false;
      case "transcript":
        return hold.blocksTranscript ?? false;
      case "diploma":
        return hold.blocksDiploma ?? false;
      case "graduation":
        // Diploma blocks also block graduation
        return hold.blocksDiploma ?? false;
      default:
        return false;
    }
  });

  return {
    hasBlockingHolds: blockingHolds.length > 0,
    holds: blockingHolds.map((h) => ({
      id: h.id,
      holdCode: h.holdCode,
      holdName: h.holdName,
      description: h.description,
      releaseAuthority: h.releaseAuthority,
    })),
  };
}

/**
 * Middleware factory for hold validation
 *
 * Usage:
 * ```typescript
 * protectedProcedure
 *   .input(...)
 *   .use(validateNoHolds({
 *     checkType: "registration",
 *     studentIdGetter: (input) => input.studentId
 *   }))
 *   .mutation(...)
 * ```
 */
export function validateNoHolds(options: HoldValidationOptions) {
  return async ({ ctx, input, next }: any) => {
    const studentId = options.studentIdGetter(input);

    // Check for override permission if allowed
    if (options.allowOverride) {
      const isAdmin = ["ADMIN", "REGISTRAR"].some((role) =>
        ctx.user?.roles.includes(role)
      );
      if (isAdmin) {
        // Admin can override - skip hold check
        return next({ ctx });
      }
    }

    // Check for blocking holds
    const holdCheck = await checkStudentHolds(ctx, studentId, options.checkType);

    if (holdCheck.hasBlockingHolds) {
      const holdList = holdCheck.holds
        .map((h) => `${h.holdName} (${h.holdCode})`)
        .join(", ");

      const defaultMessage = `Cannot proceed due to ${options.checkType} hold(s): ${holdList}`;

      throw new TRPCError({
        code: "FORBIDDEN",
        message: options.errorMessage ?? defaultMessage,
        cause: {
          holds: holdCheck.holds,
          checkType: options.checkType,
        },
      });
    }

    return next({ ctx });
  };
}

/**
 * Helper function to get hold summary for display
 */
export async function getHoldSummary(ctx: Context, studentId: string) {
  const now = new Date();

  const allHolds = await ctx.db.query.registrationHolds.findMany({
    where: and(
      eq(registrationHolds.studentId, studentId),
      isNull(registrationHolds.resolvedAt)
    ),
  });

  // Filter to currently effective holds
  const effectiveHolds = allHolds.filter((hold) => {
    const effectiveFrom = hold.effectiveFrom ?? new Date(0);
    return (
      effectiveFrom <= now &&
      (hold.effectiveUntil === null || hold.effectiveUntil > now)
    );
  });

  return {
    totalActiveHolds: effectiveHolds.length,
    blocksRegistration: effectiveHolds.some((h) => h.blocksRegistration),
    blocksGrades: effectiveHolds.some((h) => h.blocksGrades),
    blocksTranscript: effectiveHolds.some((h) => h.blocksTranscript),
    blocksDiploma: effectiveHolds.some((h) => h.blocksDiploma),
    holds: effectiveHolds.map((h) => ({
      id: h.id,
      holdCode: h.holdCode,
      holdName: h.holdName,
      holdType: h.holdType,
      description: h.description,
      blocksRegistration: h.blocksRegistration,
      blocksGrades: h.blocksGrades,
      blocksTranscript: h.blocksTranscript,
      blocksDiploma: h.blocksDiploma,
      effectiveFrom: h.effectiveFrom,
      effectiveUntil: h.effectiveUntil,
      releaseAuthority: h.releaseAuthority,
    })),
  };
}
