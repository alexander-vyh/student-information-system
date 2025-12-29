/**
 * Satisfactory Academic Progress (SAP) Types
 *
 * Types for calculating SAP status per federal regulations (34 CFR 668.34).
 * SAP is required for Title IV financial aid eligibility.
 */

/**
 * Input data for SAP calculation
 */
export interface SapInput {
  /** Student's cumulative attempted credits (all terms) */
  cumulativeAttemptedCredits: number;

  /** Student's cumulative earned credits (passed courses) */
  cumulativeEarnedCredits: number;

  /** Student's cumulative GPA */
  cumulativeGpa: number | null;

  /** Program's total required credits for graduation */
  programCredits: number;

  /** Maximum timeframe as percentage of program (typically 150%) */
  maxTimeframePercentage?: number;

  /** Student's previous SAP status (for progression rules) */
  previousSapStatus?: SapStatus;

  /** Whether student has an approved appeal */
  appealApproved?: boolean;

  /** Whether student is on an academic plan */
  onAcademicPlan?: boolean;

  /** Academic plan requirements (if on plan) */
  academicPlanRequirements?: AcademicPlanRequirements;
}

/**
 * SAP Policy configuration for an institution/program
 */
export interface SapPolicy {
  /** Minimum cumulative GPA required */
  minimumGpa: number;

  /** Minimum pace (completion rate) required as decimal (e.g., 0.67 for 67%) */
  minimumPace: number;

  /** Maximum timeframe as percentage of program length (e.g., 1.5 for 150%) */
  maxTimeframePercentage: number;

  /** Whether to check SAP at end of each term or annually */
  evaluationFrequency: "term" | "annual" | "payment_period";

  /** Warning period allowed before probation/suspension */
  allowWarningPeriod: boolean;

  /** Whether to allow probation after appeal */
  allowProbationAfterAppeal: boolean;

  /** Program-specific GPA requirements by credit threshold */
  gpaRequirementsByCredits?: GpaRequirement[];
}

/**
 * GPA requirements that vary by credit level
 * (e.g., 1.5 GPA for 0-30 credits, 1.75 for 31-60, 2.0 for 61+)
 */
export interface GpaRequirement {
  minCredits: number;
  maxCredits: number | null; // null = no max
  minimumGpa: number;
}

/**
 * Academic plan requirements when student is on probation with plan
 */
export interface AcademicPlanRequirements {
  /** Minimum GPA required for the current term */
  termMinimumGpa?: number;

  /** Minimum completion rate for the current term */
  termMinimumPace?: number;

  /** Maximum credits allowed for the term */
  maxTermCredits?: number;

  /** Required courses that must be completed */
  requiredCourses?: string[];

  /** Number of terms remaining on plan */
  termsRemaining: number;
}

/**
 * SAP Status values
 */
export type SapStatus =
  | "satisfactory" // Meeting all requirements
  | "warning" // First failure, given one term to improve
  | "probation" // After appeal approval, must meet plan requirements
  | "academic_plan" // On structured academic plan
  | "suspension" // Not meeting requirements, not eligible for aid
  | "ineligible"; // Exceeded max timeframe or other permanent ineligibility

/**
 * Result of SAP calculation
 */
export interface SapResult {
  /** Overall SAP status */
  status: SapStatus;

  /** Whether student is eligible for federal financial aid */
  eligibleForAid: boolean;

  /** GPA component details */
  gpaComponent: {
    currentGpa: number | null;
    requiredGpa: number;
    met: boolean;
    deficit?: number; // How far below requirement
  };

  /** Pace (completion rate) component details */
  paceComponent: {
    attemptedCredits: number;
    earnedCredits: number;
    pacePercentage: number;
    requiredPace: number;
    met: boolean;
    deficit?: number;
  };

  /** Maximum timeframe component details */
  maxTimeframeComponent: {
    attemptedCredits: number;
    maxAllowedCredits: number;
    percentageUsed: number;
    exceeded: boolean;
    creditsRemaining: number;
  };

  /** Whether each component was met */
  allRequirementsMet: boolean;

  /** Reason for status determination */
  statusReason: string;

  /** Recommended actions for student */
  recommendations: string[];

  /** Academic plan compliance (if applicable) */
  academicPlanCompliance?: {
    onPlan: boolean;
    meetingPlanRequirements: boolean;
    planDetails?: string;
  };
}

/**
 * SAP evaluation result for batch processing
 */
export interface SapEvaluationBatch {
  studentId: string;
  evaluationDate: Date;
  result: SapResult;
  previousStatus?: SapStatus;
  statusChanged: boolean;
}
