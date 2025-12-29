/**
 * @sis/api - tRPC API Layer
 *
 * This package provides type-safe API procedures using tRPC.
 */

// Export router and type
export { appRouter, type AppRouter } from "./root.js";

// Export context and procedure utilities
export {
  createContext,
  type Context,
  router,
  publicProcedure,
  protectedProcedure,
  requireRole,
  canAccessStudent,
  createCallerFactory,
} from "./trpc.js";

// Re-export routers for direct use
export { healthRouter } from "./routers/health.js";
export { studentRouter } from "./routers/student.js";
export { enrollmentRouter } from "./routers/enrollment.js";
export { schedulingRouter } from "./routers/scheduling.js";
export { courseSubstitutionRouter } from "./routers/course-substitution.js";
export { gradeChangeRouter } from "./routers/grade-change.js";

// Audit logging
export * from "./audit/index.js";
