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
import { bursarRouter } from "./routers/bursar.js";
import { transcriptRouter } from "./routers/transcript.js";
import { graduationRouter } from "./routers/graduation.js";
import { transferCreditRouter } from "./routers/transfer-credit.js";
import { courseSubstitutionRouter } from "./routers/course-substitution.js";
import { gradeChangeRouter } from "./routers/grade-change.js";

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
  bursar: bursarRouter,
  transcript: transcriptRouter,
  graduation: graduationRouter,
  transferCredit: transferCreditRouter,
  courseSubstitution: courseSubstitutionRouter,
  gradeChange: gradeChangeRouter,

  // TODO: Add more routers as they are implemented
  // aid: aidRouter,
  // curriculum: curriculumRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
