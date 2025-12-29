/**
 * Services Module
 *
 * Business logic services that can be tested independently of tRPC.
 * Services return Result<T, E> instead of throwing, enabling:
 * - Explicit error handling
 * - Easy unit testing with mock databases
 * - Composable operations
 *
 * Usage in router:
 *   import { EnrollmentService } from "../services/index.js";
 *   import { mapToTRPC } from "../errors/index.js";
 *
 *   const service = new EnrollmentService(ctx.db);
 *   const result = await service.enroll(input);
 *   if (!result.ok) throw mapToTRPC(result.error);
 *   return result.value;
 */

export {
  EnrollmentService,
  createEnrollmentService,
  type EnrollInput,
  type EnrollResult,
  type DropInput,
  type DropResult,
  type EligibilityCheckResult,
  type PrerequisiteCheckResult,
  type ScheduleConflictResult,
} from "./enrollment-service.js";
