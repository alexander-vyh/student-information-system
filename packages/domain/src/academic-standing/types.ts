/**
 * Academic Standing Types
 *
 * Pure TypeScript types for academic standing calculation.
 * No database dependencies.
 */

/**
 * Possible academic standing statuses
 */
export type AcademicStandingStatus =
  | "good_standing"
  | "academic_warning"
  | "academic_probation"
  | "academic_suspension"
  | "academic_dismissal"
  | "reinstated";

/**
 * Credit-based threshold for institutions that vary GPA requirements by credits completed
 */
export interface CreditBasedThreshold {
  /** Maximum credits for this threshold tier (inclusive) */
  maxCredits: number;
  /** Minimum GPA for good standing at this credit level */
  goodStandingMinGpa: number;
  /** Minimum GPA before triggering probation at this credit level */
  probationMinGpa?: number;
}

/**
 * Academic standing policy configuration
 */
export interface AcademicStandingPolicy {
  id: string;
  code: string;
  name: string;

  /** Academic level this policy applies to (e.g., "undergraduate", "graduate") */
  levelCode?: string;

  /** Minimum cumulative GPA required for good standing */
  goodStandingMinGpa: number;

  /** GPA threshold for academic warning (optional intermediate state) */
  warningMinGpa?: number;

  /** GPA threshold below which student is placed on probation */
  probationMinGpa?: number;

  /** Maximum consecutive terms allowed on probation before suspension */
  probationMaxTerms: number;

  /** Number of terms a suspended student must sit out */
  suspensionDurationTerms: number;

  /** Maximum number of suspensions before dismissal */
  maxSuspensions: number;

  /** Credit-based threshold tiers (for institutions with sliding scale) */
  thresholdsByCredits?: CreditBasedThreshold[];

  /** Whether minimum credits per term is required */
  requiresMinimumCredits: boolean;

  /** Minimum credits per term required (if requiresMinimumCredits is true) */
  minimumCreditsPerTerm?: number;
}

/**
 * Student's previous standing history entry
 */
export interface StandingHistoryEntry {
  termId: string;
  standing: AcademicStandingStatus;
  termGpa?: number;
  cumulativeGpa?: number;
  termCreditsAttempted?: number;
  termCreditsEarned?: number;
  consecutiveProbationTerms: number;
  totalProbationTerms: number;
  totalSuspensions: number;
}

/**
 * Input for calculating academic standing
 */
export interface AcademicStandingInput {
  /** Current term being evaluated */
  termId: string;

  /** Student's cumulative GPA */
  cumulativeGpa: number;

  /** Student's GPA for the current term only */
  termGpa: number;

  /** Total credits attempted (cumulative) */
  cumulativeCreditsAttempted: number;

  /** Total credits earned (cumulative) */
  cumulativeCreditsEarned: number;

  /** Credits attempted this term */
  termCreditsAttempted: number;

  /** Credits earned this term */
  termCreditsEarned: number;

  /** Current academic standing before this evaluation */
  currentStanding?: AcademicStandingStatus;

  /** Standing history for tracking progression */
  previousHistory?: StandingHistoryEntry[];

  /** The policy to evaluate against */
  policy: AcademicStandingPolicy;
}

/**
 * Result of academic standing calculation
 */
export interface AcademicStandingResult {
  /** The determined standing */
  standing: AcademicStandingStatus;

  /** Previous standing (before this evaluation) */
  previousStanding?: AcademicStandingStatus;

  /** Whether standing changed from previous */
  standingChanged: boolean;

  /** Human-readable reason for the standing determination */
  reason: string;

  /** The effective GPA threshold that was applied */
  appliedThreshold: {
    goodStandingMinGpa: number;
    probationMinGpa?: number;
    warningMinGpa?: number;
  };

  /** Probation tracking */
  probationTracking: {
    consecutiveTerms: number;
    totalTerms: number;
    maxTermsBeforeSuspension: number;
    termsRemaining?: number;
  };

  /** Suspension tracking */
  suspensionTracking: {
    totalSuspensions: number;
    maxSuspensions: number;
    suspensionsRemaining: number;
  };

  /** Action items or warnings for the student */
  actionItems: string[];

  /** Whether an appeal is recommended */
  appealRecommended: boolean;
}

/**
 * Options for batch standing calculation
 */
export interface BatchCalculationOptions {
  /** Term ID to calculate for */
  termId: string;

  /** Only process students with enrollment in this term */
  onlyEnrolledStudents?: boolean;

  /** Only process students whose standing may change */
  onlyPotentialChanges?: boolean;
}

/**
 * Result of batch standing calculation
 */
export interface BatchCalculationResult {
  totalProcessed: number;
  standingCounts: Record<AcademicStandingStatus, number>;
  changesFromPrevious: number;
  errors: Array<{
    studentId: string;
    error: string;
  }>;
}
