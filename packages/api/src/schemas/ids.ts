/**
 * ID Zod Schemas
 *
 * Zod schemas for validating and transforming UUID strings to branded ID types.
 * Used in tRPC router input validation.
 *
 * Usage:
 *   import { studentIdSchema, termIdSchema } from "../schemas/ids.js";
 *
 *   .input(z.object({
 *     studentId: studentIdSchema,
 *     termId: termIdSchema,
 *   }))
 *
 * The schemas validate UUID format and transform to branded types.
 */

import { z } from "zod";
import {
  // Core
  InstitutionId,
  CampusId,
  TermId,
  AcademicYearId,
  CalendarEventId,
  // Identity
  UserId,
  RoleId,
  PermissionId,
  // Student
  StudentId,
  StudentProgramId,
  ProgramId,
  MajorId,
  MinorId,
  ConcentrationId,
  AdvisorAssignmentId,
  // Curriculum
  SubjectId,
  CourseId,
  SectionId,
  RequisiteId,
  GradeScaleId,
  CatalogYearId,
  // Enrollment
  RegistrationId,
  WaitlistEntryId,
  HoldId,
  TransferCreditId,
  TransferInstitutionId,
  TestScoreId,
  DegreeRequirementId,
  DegreeAuditId,
  // Financial
  StudentAccountId,
  LedgerEntryId,
  PaymentPlanId,
  Tax1098TId,
  // Financial Aid
  IsirId,
  AidAwardId,
  SapEvaluationId,
  R2T4CalculationId,
  DisbursementId,
  // Registrar
  GraduationApplicationId,
  TranscriptRequestId,
  CeremonyId,
  // Scheduling
  RoomId,
  BuildingId,
  MeetingPatternId,
} from "@sis/db/ids";

// =============================================================================
// Base UUID Schema
// =============================================================================

const uuidSchema = z.string().uuid();

// =============================================================================
// Core ID Schemas
// =============================================================================

export const institutionIdSchema = uuidSchema.transform(InstitutionId);
export const campusIdSchema = uuidSchema.transform(CampusId);
export const termIdSchema = uuidSchema.transform(TermId);
export const academicYearIdSchema = uuidSchema.transform(AcademicYearId);
export const calendarEventIdSchema = uuidSchema.transform(CalendarEventId);

// =============================================================================
// Identity ID Schemas
// =============================================================================

export const userIdSchema = uuidSchema.transform(UserId);
export const roleIdSchema = uuidSchema.transform(RoleId);
export const permissionIdSchema = uuidSchema.transform(PermissionId);

// =============================================================================
// Student ID Schemas
// =============================================================================

export const studentIdSchema = uuidSchema.transform(StudentId);
export const studentProgramIdSchema = uuidSchema.transform(StudentProgramId);
export const programIdSchema = uuidSchema.transform(ProgramId);
export const majorIdSchema = uuidSchema.transform(MajorId);
export const minorIdSchema = uuidSchema.transform(MinorId);
export const concentrationIdSchema = uuidSchema.transform(ConcentrationId);
export const advisorAssignmentIdSchema =
  uuidSchema.transform(AdvisorAssignmentId);

// =============================================================================
// Curriculum ID Schemas
// =============================================================================

export const subjectIdSchema = uuidSchema.transform(SubjectId);
export const courseIdSchema = uuidSchema.transform(CourseId);
export const sectionIdSchema = uuidSchema.transform(SectionId);
export const requisiteIdSchema = uuidSchema.transform(RequisiteId);
export const gradeScaleIdSchema = uuidSchema.transform(GradeScaleId);
export const catalogYearIdSchema = uuidSchema.transform(CatalogYearId);

// =============================================================================
// Enrollment ID Schemas
// =============================================================================

export const registrationIdSchema = uuidSchema.transform(RegistrationId);
export const waitlistEntryIdSchema = uuidSchema.transform(WaitlistEntryId);
export const holdIdSchema = uuidSchema.transform(HoldId);
export const transferCreditIdSchema = uuidSchema.transform(TransferCreditId);
export const transferInstitutionIdSchema = uuidSchema.transform(
  TransferInstitutionId
);
export const testScoreIdSchema = uuidSchema.transform(TestScoreId);
export const degreeRequirementIdSchema =
  uuidSchema.transform(DegreeRequirementId);
export const degreeAuditIdSchema = uuidSchema.transform(DegreeAuditId);

// =============================================================================
// Financial ID Schemas
// =============================================================================

export const studentAccountIdSchema = uuidSchema.transform(StudentAccountId);
export const ledgerEntryIdSchema = uuidSchema.transform(LedgerEntryId);
export const paymentPlanIdSchema = uuidSchema.transform(PaymentPlanId);
export const tax1098TIdSchema = uuidSchema.transform(Tax1098TId);

// =============================================================================
// Financial Aid ID Schemas
// =============================================================================

export const isirIdSchema = uuidSchema.transform(IsirId);
export const aidAwardIdSchema = uuidSchema.transform(AidAwardId);
export const sapEvaluationIdSchema = uuidSchema.transform(SapEvaluationId);
export const r2t4CalculationIdSchema = uuidSchema.transform(R2T4CalculationId);
export const disbursementIdSchema = uuidSchema.transform(DisbursementId);

// =============================================================================
// Registrar ID Schemas
// =============================================================================

export const graduationApplicationIdSchema = uuidSchema.transform(
  GraduationApplicationId
);
export const transcriptRequestIdSchema =
  uuidSchema.transform(TranscriptRequestId);
export const ceremonyIdSchema = uuidSchema.transform(CeremonyId);

// =============================================================================
// Scheduling ID Schemas
// =============================================================================

export const roomIdSchema = uuidSchema.transform(RoomId);
export const buildingIdSchema = uuidSchema.transform(BuildingId);
export const meetingPatternIdSchema = uuidSchema.transform(MeetingPatternId);

// =============================================================================
// Optional ID Schemas (for nullable foreign keys)
// =============================================================================

export const optionalStudentIdSchema = studentIdSchema.optional();
export const optionalTermIdSchema = termIdSchema.optional();
export const optionalCourseIdSchema = courseIdSchema.optional();
export const optionalSectionIdSchema = sectionIdSchema.optional();
export const optionalProgramIdSchema = programIdSchema.optional();
export const optionalInstitutionIdSchema = institutionIdSchema.optional();

// =============================================================================
// Nullable ID Schemas (for fields that can be null)
// =============================================================================

export const nullableStudentIdSchema = studentIdSchema.nullable();
export const nullableTermIdSchema = termIdSchema.nullable();
export const nullableCourseIdSchema = courseIdSchema.nullable();
export const nullableSectionIdSchema = sectionIdSchema.nullable();
