/**
 * Satisfactory Academic Progress (SAP) Calculator
 *
 * Implements SAP calculation per federal regulations (34 CFR 668.34).
 * Pure TypeScript with no database dependencies.
 *
 * SAP has three components:
 * 1. GPA Requirement - Minimum cumulative GPA
 * 2. Pace Requirement - Minimum completion rate (earned/attempted)
 * 3. Maximum Timeframe - Cannot attempt more than 150% of program credits
 */

import type {
  SapInput,
  SapPolicy,
  SapResult,
  SapStatus,
  GpaRequirement,
} from "./types.js";

/**
 * Default SAP policy (common federal requirements)
 */
export const DEFAULT_SAP_POLICY: SapPolicy = {
  minimumGpa: 2.0,
  minimumPace: 0.67, // 67% completion rate
  maxTimeframePercentage: 1.5, // 150% of program length
  evaluationFrequency: "term",
  allowWarningPeriod: true,
  allowProbationAfterAppeal: true,
};

/**
 * Calculate SAP status for a student
 *
 * @param input - Student's academic data
 * @param policy - Institution's SAP policy
 * @returns SAP calculation result
 */
export function calculateSap(
  input: SapInput,
  policy: SapPolicy = DEFAULT_SAP_POLICY
): SapResult {
  const {
    cumulativeAttemptedCredits,
    cumulativeEarnedCredits,
    cumulativeGpa,
    programCredits,
    previousSapStatus,
    appealApproved,
    onAcademicPlan,
    academicPlanRequirements,
  } = input;

  const maxTimeframePercentage =
    input.maxTimeframePercentage ?? policy.maxTimeframePercentage;

  // Calculate each component
  const gpaComponent = evaluateGpaRequirement(
    cumulativeGpa,
    cumulativeAttemptedCredits,
    policy
  );

  const paceComponent = evaluatePaceRequirement(
    cumulativeAttemptedCredits,
    cumulativeEarnedCredits,
    policy.minimumPace
  );

  const maxTimeframeComponent = evaluateMaxTimeframe(
    cumulativeAttemptedCredits,
    programCredits,
    maxTimeframePercentage
  );

  // Determine if all requirements are met
  const allRequirementsMet =
    gpaComponent.met && paceComponent.met && !maxTimeframeComponent.exceeded;

  // Determine SAP status
  const { status, statusReason, eligibleForAid } = determineSapStatus({
    allRequirementsMet,
    gpaComponent,
    paceComponent,
    maxTimeframeComponent,
    previousSapStatus,
    appealApproved,
    onAcademicPlan,
    academicPlanRequirements,
    policy,
  });

  // Generate recommendations
  const recommendations = generateRecommendations({
    status,
    gpaComponent,
    paceComponent,
    maxTimeframeComponent,
    onAcademicPlan,
  });

  // Academic plan compliance
  let academicPlanCompliance;
  if (onAcademicPlan && academicPlanRequirements) {
    academicPlanCompliance = evaluateAcademicPlanCompliance(
      input,
      academicPlanRequirements
    );
  }

  return {
    status,
    eligibleForAid,
    gpaComponent,
    paceComponent,
    maxTimeframeComponent,
    allRequirementsMet,
    statusReason,
    recommendations,
    academicPlanCompliance,
  };
}

/**
 * Evaluate GPA requirement
 */
function evaluateGpaRequirement(
  currentGpa: number | null,
  attemptedCredits: number,
  policy: SapPolicy
): SapResult["gpaComponent"] {
  // Get required GPA (may vary by credit level)
  const requiredGpa = getRequiredGpa(attemptedCredits, policy);

  // If no GPA yet (no graded courses), consider met
  if (currentGpa === null) {
    return {
      currentGpa: null,
      requiredGpa,
      met: true, // No grades yet, cannot fail
    };
  }

  const met = currentGpa >= requiredGpa;
  const deficit = met ? undefined : requiredGpa - currentGpa;

  return {
    currentGpa,
    requiredGpa,
    met,
    deficit,
  };
}

/**
 * Get required GPA based on credit level (if tiered)
 */
function getRequiredGpa(attemptedCredits: number, policy: SapPolicy): number {
  if (!policy.gpaRequirementsByCredits?.length) {
    return policy.minimumGpa;
  }

  // Find applicable tier
  for (const tier of policy.gpaRequirementsByCredits) {
    if (
      attemptedCredits >= tier.minCredits &&
      (tier.maxCredits === null || attemptedCredits <= tier.maxCredits)
    ) {
      return tier.minimumGpa;
    }
  }

  // Default to policy minimum
  return policy.minimumGpa;
}

/**
 * Evaluate pace (completion rate) requirement
 */
function evaluatePaceRequirement(
  attemptedCredits: number,
  earnedCredits: number,
  minimumPace: number
): SapResult["paceComponent"] {
  // Avoid division by zero
  if (attemptedCredits === 0) {
    return {
      attemptedCredits: 0,
      earnedCredits: 0,
      pacePercentage: 1.0, // 100% if nothing attempted
      requiredPace: minimumPace,
      met: true,
    };
  }

  const pacePercentage = earnedCredits / attemptedCredits;
  const met = pacePercentage >= minimumPace;
  const deficit = met ? undefined : minimumPace - pacePercentage;

  return {
    attemptedCredits,
    earnedCredits,
    pacePercentage: Math.round(pacePercentage * 10000) / 10000, // 4 decimal places
    requiredPace: minimumPace,
    met,
    deficit,
  };
}

/**
 * Evaluate maximum timeframe requirement
 */
function evaluateMaxTimeframe(
  attemptedCredits: number,
  programCredits: number,
  maxTimeframePercentage: number
): SapResult["maxTimeframeComponent"] {
  const maxAllowedCredits = programCredits * maxTimeframePercentage;
  const percentageUsed = attemptedCredits / maxAllowedCredits;
  const exceeded = attemptedCredits >= maxAllowedCredits;
  const creditsRemaining = Math.max(0, maxAllowedCredits - attemptedCredits);

  return {
    attemptedCredits,
    maxAllowedCredits,
    percentageUsed: Math.round(percentageUsed * 10000) / 10000,
    exceeded,
    creditsRemaining,
  };
}

/**
 * Determine SAP status based on component results and history
 */
function determineSapStatus(params: {
  allRequirementsMet: boolean;
  gpaComponent: SapResult["gpaComponent"];
  paceComponent: SapResult["paceComponent"];
  maxTimeframeComponent: SapResult["maxTimeframeComponent"];
  previousSapStatus?: SapStatus;
  appealApproved?: boolean;
  onAcademicPlan?: boolean;
  academicPlanRequirements?: SapInput["academicPlanRequirements"];
  policy: SapPolicy;
}): { status: SapStatus; statusReason: string; eligibleForAid: boolean } {
  const {
    allRequirementsMet,
    gpaComponent,
    paceComponent,
    maxTimeframeComponent,
    previousSapStatus,
    appealApproved,
    onAcademicPlan,
    academicPlanRequirements,
    policy,
  } = params;

  // Maximum timeframe exceeded is typically permanent ineligibility
  if (maxTimeframeComponent.exceeded) {
    return {
      status: "ineligible",
      statusReason:
        "Maximum timeframe exceeded. Student has attempted 150% or more of program credits.",
      eligibleForAid: false,
    };
  }

  // Meeting all requirements = satisfactory
  if (allRequirementsMet) {
    return {
      status: "satisfactory",
      statusReason: "Student is meeting all SAP requirements.",
      eligibleForAid: true,
    };
  }

  // On academic plan - check plan compliance
  if (onAcademicPlan && academicPlanRequirements) {
    return {
      status: "academic_plan",
      statusReason:
        "Student is on an academic plan and must meet plan requirements to maintain aid eligibility.",
      eligibleForAid: true, // Eligible while on plan
    };
  }

  // Appeal approved - move to probation
  if (appealApproved && policy.allowProbationAfterAppeal) {
    return {
      status: "probation",
      statusReason:
        "Appeal approved. Student is on financial aid probation and must meet SAP requirements or academic plan by end of next term.",
      eligibleForAid: true,
    };
  }

  // First failure with warning period allowed
  if (
    policy.allowWarningPeriod &&
    (!previousSapStatus || previousSapStatus === "satisfactory")
  ) {
    return {
      status: "warning",
      statusReason:
        "Student is not meeting SAP requirements but is being placed on warning for one term.",
      eligibleForAid: true, // Still eligible during warning
    };
  }

  // Coming off warning, still not meeting requirements
  if (previousSapStatus === "warning") {
    return {
      status: "suspension",
      statusReason:
        "Student did not meet SAP requirements during warning period. Financial aid is suspended. Student may appeal.",
      eligibleForAid: false,
    };
  }

  // Coming off probation, still not meeting requirements
  if (previousSapStatus === "probation" || previousSapStatus === "academic_plan") {
    return {
      status: "suspension",
      statusReason:
        "Student did not meet SAP requirements during probation period. Financial aid is suspended.",
      eligibleForAid: false,
    };
  }

  // Default to suspension
  return {
    status: "suspension",
    statusReason:
      "Student is not meeting SAP requirements and is not eligible for financial aid.",
    eligibleForAid: false,
  };
}

/**
 * Evaluate compliance with academic plan requirements
 */
function evaluateAcademicPlanCompliance(
  input: SapInput,
  requirements: NonNullable<SapInput["academicPlanRequirements"]>
): SapResult["academicPlanCompliance"] {
  // This would typically compare term-level performance against plan requirements
  // Simplified implementation - actual would need term GPA and completion data
  return {
    onPlan: true,
    meetingPlanRequirements: true, // Would need term data to evaluate
    planDetails: `Student has ${requirements.termsRemaining} term(s) remaining on academic plan.`,
  };
}

/**
 * Generate recommendations based on SAP status
 */
function generateRecommendations(params: {
  status: SapStatus;
  gpaComponent: SapResult["gpaComponent"];
  paceComponent: SapResult["paceComponent"];
  maxTimeframeComponent: SapResult["maxTimeframeComponent"];
  onAcademicPlan?: boolean;
}): string[] {
  const { status, gpaComponent, paceComponent, maxTimeframeComponent } = params;

  const recommendations: string[] = [];

  switch (status) {
    case "satisfactory":
      recommendations.push(
        "Continue maintaining current academic performance."
      );
      break;

    case "warning":
      if (!gpaComponent.met) {
        recommendations.push(
          `Improve GPA to at least ${gpaComponent.requiredGpa}. Consider tutoring or reducing course load.`
        );
      }
      if (!paceComponent.met) {
        recommendations.push(
          `Complete at least ${Math.round(paceComponent.requiredPace * 100)}% of attempted credits. Avoid withdrawals.`
        );
      }
      recommendations.push(
        "Meet with academic advisor to develop improvement plan."
      );
      break;

    case "probation":
    case "academic_plan":
      recommendations.push(
        "Follow all academic plan requirements strictly."
      );
      recommendations.push(
        "Meet regularly with academic advisor."
      );
      recommendations.push(
        "Consider using campus support services (tutoring, counseling)."
      );
      break;

    case "suspension":
      recommendations.push(
        "Submit SAP appeal with supporting documentation if circumstances warrant."
      );
      recommendations.push(
        "Include academic plan showing how you will meet requirements."
      );
      recommendations.push(
        "Consider paying out of pocket or taking time off to improve academic standing."
      );
      break;

    case "ineligible":
      recommendations.push(
        "Maximum timeframe has been exceeded. Federal aid is no longer available for this program."
      );
      recommendations.push(
        "Consider alternative funding options or program change."
      );
      recommendations.push(
        "Speak with financial aid office about any potential exceptions."
      );
      break;
  }

  // Add max timeframe warning if approaching limit
  if (
    !maxTimeframeComponent.exceeded &&
    maxTimeframeComponent.percentageUsed > 0.9
  ) {
    recommendations.push(
      `Warning: Only ${Math.round(maxTimeframeComponent.creditsRemaining)} credits remaining before maximum timeframe is reached.`
    );
  }

  return recommendations;
}

/**
 * Check if a student would regain SAP satisfactory status with hypothetical grades
 */
export function projectSapStatus(
  currentInput: SapInput,
  projectedAttemptedCredits: number,
  projectedEarnedCredits: number,
  projectedGpa: number,
  policy: SapPolicy = DEFAULT_SAP_POLICY
): SapResult {
  const projectedInput: SapInput = {
    ...currentInput,
    cumulativeAttemptedCredits:
      currentInput.cumulativeAttemptedCredits + projectedAttemptedCredits,
    cumulativeEarnedCredits:
      currentInput.cumulativeEarnedCredits + projectedEarnedCredits,
    cumulativeGpa: projectedGpa,
  };

  return calculateSap(projectedInput, policy);
}
