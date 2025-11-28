/**
 * Root Router
 *
 * Combines all domain routers into the main app router.
 */

import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { studentRouter } from "./routers/student.js";
import { enrollmentRouter } from "./routers/enrollment.js";

/**
 * Main application router
 */
export const appRouter = router({
  health: healthRouter,
  student: studentRouter,
  enrollment: enrollmentRouter,

  // TODO: Add more routers as they are implemented
  // financial: financialRouter,
  // aid: aidRouter,
  // curriculum: curriculumRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
