/**
 * Root Router
 *
 * Combines all domain routers into the main app router.
 */

import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { studentRouter } from "./routers/student.js";
import { enrollmentRouter } from "./routers/enrollment.js";
import { adminRouter } from "./routers/admin.js";
import { holdsRouter } from "./routers/holds.js";
import { registrationControlRouter } from "./routers/registration-control.js";
import { censusRouter } from "./routers/census.js";
import { schedulingRouter } from "./routers/scheduling.js";
import { degreeAuditRouter } from "./routers/degree-audit.js";
import { academicStandingRouter } from "./routers/academic-standing.js";

/**
 * Main application router
 */
export const appRouter = router({
  health: healthRouter,
  student: studentRouter,
  enrollment: enrollmentRouter,
  admin: adminRouter,
  holds: holdsRouter,
  registrationControl: registrationControlRouter,
  census: censusRouter,
  scheduling: schedulingRouter,
  degreeAudit: degreeAuditRouter,
  academicStanding: academicStandingRouter,

  // TODO: Add more routers as they are implemented
  // financial: financialRouter,
  // aid: aidRouter,
  // curriculum: curriculumRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
