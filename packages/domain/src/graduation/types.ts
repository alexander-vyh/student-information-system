/**
 * Graduation Domain Types
 *
 * Types for graduation eligibility checking, Latin honors calculation,
 * and conferral validation.
 */

/**
 * Latin honors thresholds configuration
 */
export interface LatinHonorsConfig {
  /** Minimum total credits to be eligible for honors */
  minimumCredits: number;

  /** Minimum credits earned at this institution */
  minimumInstitutionalCredits: number;

  /** GPA threshold for summa cum laude (highest distinction) */
  summaThreshold: number;

  /** GPA threshold for magna cum laude (high distinction) */
  magnaThreshold: number;

  /** GPA threshold for cum laude (distinction) */
  cumThreshold: number;

  /** Whether to exclude transfer credits from honors GPA calculation */
  excludeTransferCredits: boolean;

  /** Whether academic integrity violations disqualify from honors */
  disqualifyForAcademicIntegrity: boolean;
}

/**
 * Latin honors designation result
 */
export type LatinHonorsDesignation =
  | "summa_cum_laude"
  | "magna_cum_laude"
  | "cum_laude"
  | null;

/**
 * Input for Latin honors calculation
 */
export interface LatinHonorsInput {
  /** Cumulative GPA (all credits) */
  cumulativeGpa: number;

  /** GPA on institutional credits only (if different) */
  institutionalGpa?: number;

  /** Total earned credits */
  earnedCredits: number;

  /** Credits earned at this institution */
  institutionalCredits: number;

  /** Transfer credits */
  transferCredits: number;

  /** Whether student has academic integrity violations */
  hasAcademicIntegrityViolation: boolean;
}

/**
 * Result of Latin honors calculation
 */
export interface LatinHonorsResult {
  /** The honors designation, or null if not eligible */
  designation: LatinHonorsDesignation;

  /** GPA used for determination */
  gpaUsed: number;

  /** Whether the student meets credit requirements */
  meetsCreditsRequirement: boolean;

  /** Whether the student meets institutional credits requirement */
  meetsInstitutionalCreditsRequirement: boolean;

  /** Whether student was disqualified for academic integrity */
  disqualifiedForIntegrity: boolean;

  /** Explanation of the determination */
  explanation: string;
}

/**
 * Academic requirements status for graduation
 */
export interface AcademicRequirementsStatus {
  /** Degree audit completion percentage */
  degreeAuditCompletionPct: number;

  /** Whether all required courses are complete */
  allRequiredCoursesComplete: boolean;

  /** Whether all required credits are earned */
  allCreditsEarned: boolean;

  /** Whether minimum GPA requirements are met */
  gpaRequirementsMet: boolean;

  /** Whether residency (institutional credits) requirement is met */
  residencyRequirementMet: boolean;

  /** Whether all incomplete grades have been resolved */
  noIncompleteGrades: boolean;

  /** Whether there are any pending final grades */
  noPendingFinalGrades: boolean;

  /** Whether all milestones are complete (thesis, comps, etc.) */
  milestonesComplete: boolean;

  /** Missing requirements (for display to user) */
  missingRequirements: string[];
}

/**
 * Administrative clearance status for graduation
 */
export interface AdministrativeClearanceStatus {
  /** No holds blocking graduation */
  noBlockingHolds: boolean;

  /** Financial account is cleared */
  financialClearance: boolean;

  /** Library materials returned */
  libraryClearance: boolean;

  /** Department clearance obtained */
  departmentClearance: boolean;

  /** Exit counseling complete (if required) */
  exitCounselingComplete: boolean;

  /** SEVIS record updated (for international students, null if N/A) */
  sevisUpdated: boolean | null;

  /** List of holds blocking graduation */
  blockingHolds: BlockingHold[];

  /** Outstanding balance amount (if any) */
  outstandingBalance?: number;
}

/**
 * A hold that blocks graduation
 */
export interface BlockingHold {
  holdId: string;
  holdCode: string;
  holdName: string;
  releaseAuthority: string;
  placedDate: Date;
  category: "financial" | "academic" | "administrative" | "disciplinary";
}

/**
 * Data validation status for graduation
 */
export interface DataValidationStatus {
  /** Diploma name has been verified */
  diplomaNameVerified: boolean;

  /** Mailing address has been confirmed */
  mailingAddressConfirmed: boolean;

  /** Program record is complete */
  programRecordComplete: boolean;

  /** Major/minor declarations are complete */
  declarationsComplete: boolean;

  /** Honors have been calculated */
  honorsCalculated: boolean;

  /** Missing data fields */
  missingFields: string[];
}

/**
 * Complete graduation validation result
 */
export interface GraduationValidationResult {
  /** Overall eligibility */
  isEligible: boolean;

  /** Validation timestamp */
  validationDate: Date;

  /** Academic requirements check */
  academicChecks: AcademicRequirementsStatus;

  /** Administrative clearances check */
  administrativeChecks: AdministrativeClearanceStatus;

  /** Data validation check */
  dataValidation: DataValidationStatus;

  /** Human-readable list of blockers */
  blockers: string[];

  /** Warnings (non-blocking issues) */
  warnings: string[];
}

/**
 * Input for graduation eligibility check
 */
export interface GraduationEligibilityInput {
  studentId: string;
  studentProgramId: string;

  // Academic data
  degreeAudit: {
    completionPct: number;
    allRequirementsComplete: boolean;
    missingRequirements: string[];
  };

  gpa: {
    cumulative: number;
    institutional: number;
    major?: number;
  };

  credits: {
    totalEarned: number;
    institutionalEarned: number;
    transferCredits: number;
    inProgress: number;
  };

  grades: {
    hasIncompleteGrades: boolean;
    incompleteCount: number;
    hasPendingFinalGrades: boolean;
    pendingCount: number;
  };

  // Requirements
  requirements: {
    minimumGpa: number;
    minimumCredits: number;
    minimumInstitutionalCredits: number;
    milestonesRequired: string[];
    milestonesCompleted: string[];
  };

  // Administrative
  holds: BlockingHold[];
  financialBalance: number;
  libraryClearance: boolean;
  departmentClearance: boolean;
  exitCounselingRequired: boolean;
  exitCounselingComplete: boolean;

  // International students
  isInternational: boolean;
  sevisUpdated?: boolean;

  // Data validation
  diplomaName: string | null;
  mailingAddress: unknown | null;
  majorDeclared: boolean;

  // Academic integrity
  hasAcademicIntegrityViolation: boolean;
}

/**
 * Graduation policy configuration
 */
export interface GraduationPolicyConfig {
  /** Minimum GPA required for graduation */
  minimumGpa: number;

  /** Minimum total credits required */
  minimumCredits: number;

  /** Minimum institutional (residency) credits required */
  minimumInstitutionalCredits: number;

  /** Maximum allowable financial balance for graduation */
  maxFinancialBalance: number;

  /** Whether exit counseling is required for financial aid recipients */
  requireExitCounseling: boolean;

  /** Whether library clearance is required */
  requireLibraryClearance: boolean;

  /** Whether department clearance is required */
  requireDepartmentClearance: boolean;

  /** Latin honors configuration */
  latinHonors: LatinHonorsConfig;
}

/**
 * Default graduation policy
 */
export const DEFAULT_GRADUATION_POLICY: GraduationPolicyConfig = {
  minimumGpa: 2.0,
  minimumCredits: 120,
  minimumInstitutionalCredits: 30,
  maxFinancialBalance: 0,
  requireExitCounseling: true,
  requireLibraryClearance: true,
  requireDepartmentClearance: true,
  latinHonors: {
    minimumCredits: 60,
    minimumInstitutionalCredits: 60,
    summaThreshold: 3.9,
    magnaThreshold: 3.7,
    cumThreshold: 3.5,
    excludeTransferCredits: false,
    disqualifyForAcademicIntegrity: true,
  },
};

/**
 * Batch conferral input for a single student
 */
export interface BatchConferralStudentInput {
  studentId: string;
  studentProgramId: string;
  graduationApplicationId: string;
  diplomaName: string;
  programName: string;
  degreeCode: string;
  gpa: {
    cumulative: number;
    institutional: number;
  };
  credits: {
    totalEarned: number;
    institutionalEarned: number;
    transferCredits: number;
  };
  hasAcademicIntegrityViolation: boolean;
}

/**
 * Result of batch conferral for a single student
 */
export interface BatchConferralStudentResult {
  studentId: string;
  studentProgramId: string;
  graduationApplicationId: string;
  status: "conferred" | "failed" | "skipped";
  degreeAwarded?: string;
  conferralDate?: Date;
  honorsDesignation?: LatinHonorsDesignation;
  failureReason?: string;
  blockers?: string[];
}
