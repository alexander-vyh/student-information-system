/**
 * tRPC Server Configuration
 *
 * This file sets up the tRPC server with context, procedures, and middleware.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { db } from "@sis/db";

/**
 * Context passed to all tRPC procedures
 */
export interface Context {
  /** Database client */
  db: typeof db;

  /** Authenticated user (if any) */
  user: {
    id: string;
    email: string;
    roles: string[];
    institutionId: string;
    studentId?: string;
  } | null;

  /** Current session */
  session: {
    id: string;
    expiresAt: Date;
  } | null;

  /** Request metadata */
  req: {
    ip?: string;
    userAgent?: string;
  };
}

/**
 * Create context for each request
 */
export function createContext(opts: {
  db: typeof db;
  user?: Context["user"];
  session?: Context["session"];
  req?: Context["req"];
}): Context {
  return {
    db: opts.db,
    user: opts.user ?? null,
    session: opts.session ?? null,
    req: opts.req ?? {},
  };
}

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Middleware to ensure user is authenticated
 */
const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  });
});

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Middleware to check for specific role
 */
export function requireRole(...roles: string[]) {
  return middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to perform this action",
      });
    }

    const hasRole = roles.some((role) => ctx.user!.roles.includes(role));
    if (!hasRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of the following roles: ${roles.join(", ")}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });
}

/**
 * Middleware to ensure user can access a specific student's data
 * (FERPA compliance)
 */
export function canAccessStudent(getStudentId: (input: unknown) => string) {
  return middleware(async ({ ctx, input, next, path }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
      });
    }

    const studentId = getStudentId(input);

    // Student can access their own data
    if (ctx.user.studentId === studentId) {
      // Log self-access (minimal logging)
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "student_record",
          action: "view",
          actorId: ctx.user.id,
          studentId,
          selfAccess: true,
          procedure: path,
          timestamp: new Date().toISOString(),
        })
      );
      return next({ ctx });
    }

    // Staff with appropriate roles can access student data
    const staffRoles = [
      "ADMIN",
      "REGISTRAR",
      "FINANCIAL_AID",
      "BURSAR",
      "ADVISOR",
    ];
    if (staffRoles.some((role) => ctx.user!.roles.includes(role))) {
      // FERPA audit log: Staff accessing student record
      console.log(
        JSON.stringify({
          type: "AUDIT_LOG",
          category: "student_record",
          action: "view",
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          actorRoles: ctx.user.roles,
          studentId,
          selfAccess: false,
          procedure: path,
          ip: ctx.req.ip,
          userAgent: ctx.req.userAgent,
          timestamp: new Date().toISOString(),
        })
      );
      return next({ ctx });
    }

    // Log denied access attempt
    console.log(
      JSON.stringify({
        type: "AUDIT_LOG",
        category: "student_record",
        action: "permission_denied",
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        actorRoles: ctx.user.roles,
        studentId,
        procedure: path,
        ip: ctx.req.ip,
        timestamp: new Date().toISOString(),
      })
    );

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this student's records",
    });
  });
}
