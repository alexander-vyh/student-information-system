/**
 * Branded ID Types
 *
 * Provides compile-time type safety for entity IDs.
 * Prevents accidentally passing a TermId where StudentId is expected.
 *
 * Usage in services/internal code:
 *   import { StudentId, TermId } from "@sis/db/ids";
 *   function getStudent(id: StudentId): Promise<Student>
 *
 * For Zod schemas (tRPC input validation), see:
 *   @sis/api - provides studentIdSchema, termIdSchema, etc.
 */

// =============================================================================
// Brand Infrastructure
// =============================================================================

declare const brand: unique symbol;

/**
 * Creates a branded type that is structurally a string but nominally distinct.
 * Brand<string, 'StudentId'> cannot be assigned to Brand<string, 'TermId'>.
 */
type Brand<T, B extends string> = T & { readonly [brand]: B };

// =============================================================================
// Core Domain IDs
// =============================================================================

/** Unique identifier for an institution */
export type InstitutionId = Brand<string, "InstitutionId">;

/** Unique identifier for a campus */
export type CampusId = Brand<string, "CampusId">;

/** Unique identifier for an academic term */
export type TermId = Brand<string, "TermId">;

/** Unique identifier for an academic year */
export type AcademicYearId = Brand<string, "AcademicYearId">;

/** Unique identifier for a calendar event */
export type CalendarEventId = Brand<string, "CalendarEventId">;

// =============================================================================
// Identity Domain IDs
// =============================================================================

/** Unique identifier for a user account */
export type UserId = Brand<string, "UserId">;

/** Unique identifier for a role */
export type RoleId = Brand<string, "RoleId">;

/** Unique identifier for a permission */
export type PermissionId = Brand<string, "PermissionId">;

// =============================================================================
// Student Domain IDs
// =============================================================================

/** Unique identifier for a student record */
export type StudentId = Brand<string, "StudentId">;

/** Unique identifier for a student's program enrollment */
export type StudentProgramId = Brand<string, "StudentProgramId">;

/** Unique identifier for a program/degree */
export type ProgramId = Brand<string, "ProgramId">;

/** Unique identifier for a major */
export type MajorId = Brand<string, "MajorId">;

/** Unique identifier for a minor */
export type MinorId = Brand<string, "MinorId">;

/** Unique identifier for a concentration */
export type ConcentrationId = Brand<string, "ConcentrationId">;

/** Unique identifier for an advisor assignment */
export type AdvisorAssignmentId = Brand<string, "AdvisorAssignmentId">;

// =============================================================================
// Curriculum Domain IDs
// =============================================================================

/** Unique identifier for a subject/department */
export type SubjectId = Brand<string, "SubjectId">;

/** Unique identifier for a course */
export type CourseId = Brand<string, "CourseId">;

/** Unique identifier for a course section */
export type SectionId = Brand<string, "SectionId">;

/** Unique identifier for a course requisite */
export type RequisiteId = Brand<string, "RequisiteId">;

/** Unique identifier for a grade scale */
export type GradeScaleId = Brand<string, "GradeScaleId">;

/** Unique identifier for a catalog year */
export type CatalogYearId = Brand<string, "CatalogYearId">;

// =============================================================================
// Enrollment Domain IDs
// =============================================================================

/** Unique identifier for a course registration */
export type RegistrationId = Brand<string, "RegistrationId">;

/** Unique identifier for a waitlist entry */
export type WaitlistEntryId = Brand<string, "WaitlistEntryId">;

/** Unique identifier for a registration hold */
export type HoldId = Brand<string, "HoldId">;

/** Unique identifier for a transfer credit */
export type TransferCreditId = Brand<string, "TransferCreditId">;

/** Unique identifier for a transfer institution */
export type TransferInstitutionId = Brand<string, "TransferInstitutionId">;

/** Unique identifier for a test score */
export type TestScoreId = Brand<string, "TestScoreId">;

/** Unique identifier for a degree requirement */
export type DegreeRequirementId = Brand<string, "DegreeRequirementId">;

/** Unique identifier for a degree audit */
export type DegreeAuditId = Brand<string, "DegreeAuditId">;

// =============================================================================
// Financial Domain IDs
// =============================================================================

/** Unique identifier for a student account */
export type StudentAccountId = Brand<string, "StudentAccountId">;

/** Unique identifier for a ledger entry */
export type LedgerEntryId = Brand<string, "LedgerEntryId">;

/** Unique identifier for a payment plan */
export type PaymentPlanId = Brand<string, "PaymentPlanId">;

/** Unique identifier for a 1098-T record */
export type Tax1098TId = Brand<string, "Tax1098TId">;

// =============================================================================
// Financial Aid Domain IDs
// =============================================================================

/** Unique identifier for an ISIR record */
export type IsirId = Brand<string, "IsirId">;

/** Unique identifier for an aid award */
export type AidAwardId = Brand<string, "AidAwardId">;

/** Unique identifier for a SAP evaluation */
export type SapEvaluationId = Brand<string, "SapEvaluationId">;

/** Unique identifier for an R2T4 calculation */
export type R2T4CalculationId = Brand<string, "R2T4CalculationId">;

/** Unique identifier for a disbursement */
export type DisbursementId = Brand<string, "DisbursementId">;

// =============================================================================
// Registrar Domain IDs
// =============================================================================

/** Unique identifier for a graduation application */
export type GraduationApplicationId = Brand<string, "GraduationApplicationId">;

/** Unique identifier for a transcript request */
export type TranscriptRequestId = Brand<string, "TranscriptRequestId">;

/** Unique identifier for a ceremony */
export type CeremonyId = Brand<string, "CeremonyId">;

// =============================================================================
// Scheduling Domain IDs
// =============================================================================

/** Unique identifier for a room */
export type RoomId = Brand<string, "RoomId">;

/** Unique identifier for a building */
export type BuildingId = Brand<string, "BuildingId">;

/** Unique identifier for a meeting pattern */
export type MeetingPatternId = Brand<string, "MeetingPatternId">;

// =============================================================================
// Factory Functions
// =============================================================================

// Core
export const InstitutionId = (id: string): InstitutionId => id as InstitutionId;
export const CampusId = (id: string): CampusId => id as CampusId;
export const TermId = (id: string): TermId => id as TermId;
export const AcademicYearId = (id: string): AcademicYearId =>
  id as AcademicYearId;
export const CalendarEventId = (id: string): CalendarEventId =>
  id as CalendarEventId;

// Identity
export const UserId = (id: string): UserId => id as UserId;
export const RoleId = (id: string): RoleId => id as RoleId;
export const PermissionId = (id: string): PermissionId => id as PermissionId;

// Student
export const StudentId = (id: string): StudentId => id as StudentId;
export const StudentProgramId = (id: string): StudentProgramId =>
  id as StudentProgramId;
export const ProgramId = (id: string): ProgramId => id as ProgramId;
export const MajorId = (id: string): MajorId => id as MajorId;
export const MinorId = (id: string): MinorId => id as MinorId;
export const ConcentrationId = (id: string): ConcentrationId =>
  id as ConcentrationId;
export const AdvisorAssignmentId = (id: string): AdvisorAssignmentId =>
  id as AdvisorAssignmentId;

// Curriculum
export const SubjectId = (id: string): SubjectId => id as SubjectId;
export const CourseId = (id: string): CourseId => id as CourseId;
export const SectionId = (id: string): SectionId => id as SectionId;
export const RequisiteId = (id: string): RequisiteId => id as RequisiteId;
export const GradeScaleId = (id: string): GradeScaleId => id as GradeScaleId;
export const CatalogYearId = (id: string): CatalogYearId => id as CatalogYearId;

// Enrollment
export const RegistrationId = (id: string): RegistrationId =>
  id as RegistrationId;
export const WaitlistEntryId = (id: string): WaitlistEntryId =>
  id as WaitlistEntryId;
export const HoldId = (id: string): HoldId => id as HoldId;
export const TransferCreditId = (id: string): TransferCreditId =>
  id as TransferCreditId;
export const TransferInstitutionId = (id: string): TransferInstitutionId =>
  id as TransferInstitutionId;
export const TestScoreId = (id: string): TestScoreId => id as TestScoreId;
export const DegreeRequirementId = (id: string): DegreeRequirementId =>
  id as DegreeRequirementId;
export const DegreeAuditId = (id: string): DegreeAuditId => id as DegreeAuditId;

// Financial
export const StudentAccountId = (id: string): StudentAccountId =>
  id as StudentAccountId;
export const LedgerEntryId = (id: string): LedgerEntryId => id as LedgerEntryId;
export const PaymentPlanId = (id: string): PaymentPlanId => id as PaymentPlanId;
export const Tax1098TId = (id: string): Tax1098TId => id as Tax1098TId;

// Financial Aid
export const IsirId = (id: string): IsirId => id as IsirId;
export const AidAwardId = (id: string): AidAwardId => id as AidAwardId;
export const SapEvaluationId = (id: string): SapEvaluationId =>
  id as SapEvaluationId;
export const R2T4CalculationId = (id: string): R2T4CalculationId =>
  id as R2T4CalculationId;
export const DisbursementId = (id: string): DisbursementId =>
  id as DisbursementId;

// Registrar
export const GraduationApplicationId = (id: string): GraduationApplicationId =>
  id as GraduationApplicationId;
export const TranscriptRequestId = (id: string): TranscriptRequestId =>
  id as TranscriptRequestId;
export const CeremonyId = (id: string): CeremonyId => id as CeremonyId;

// Scheduling
export const RoomId = (id: string): RoomId => id as RoomId;
export const BuildingId = (id: string): BuildingId => id as BuildingId;
export const MeetingPatternId = (id: string): MeetingPatternId =>
  id as MeetingPatternId;

// =============================================================================
// Type Guards
// =============================================================================

/** Check if a string is a valid UUID format */
export function isValidUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract the underlying string from a branded ID type.
 * Useful when you need to pass the raw string to external APIs.
 */
export type UnwrapId<T> = T extends Brand<infer U, string> ? U : never;

/**
 * All entity ID types for discriminated unions or generic handling.
 */
export type EntityId =
  | InstitutionId
  | CampusId
  | TermId
  | UserId
  | StudentId
  | StudentProgramId
  | ProgramId
  | CourseId
  | SectionId
  | RegistrationId
  | HoldId
  | TransferCreditId;
