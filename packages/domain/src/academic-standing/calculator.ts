/**
 * Academic Standing Calculator
 *
 * Pure TypeScript implementation for calculating academic standing.
 * No database dependencies - all data is passed in.
 */

import type {
  AcademicStandingInput,
  AcademicStandingResult,
  AcademicStandingStatus,
  AcademicStandingPolicy,
  StandingHistoryEntry,
  CreditBasedThreshold,
} from "./types.js";

/**
 * Calculate academic standing for a student
 *
 * Follows standard higher education academic progress rules:
 * 1. Check GPA against thresholds
 * 2. Track probation progression
 * 3. Apply suspension/dismissal rules
 * 4. Generate appropriate action items
 */
export function calculateAcademicStanding(
  input: AcademicStandingInput
): AcademicStandingResult {
  const { policy, cumulativeGpa, cumulativeCreditsAttempted, currentStanding, previousHistory } = input;

  // Get the applicable GPA thresholds (may vary by credits completed)
  const thresholds = getApplicableThresholds(policy, cumulativeCreditsAttempted);

  // Get previous probation/suspension tracking
  const { consecutiveProbationTerms, totalProbationTerms, totalSuspensions } =
    getPreviousTracking(previousHistory);

  // Determine new standing based on GPA and history
  const determination = determineStanding({
    cumulativeGpa,
    thresholds,
    currentStanding,
    consecutiveProbationTerms,
    totalProbationTerms,
    totalSuspensions,
    policy,
  });

  // Generate reason and action items
  const reason = generateReason(determination, thresholds, cumulativeGpa, input);
  const actionItems = generateActionItems(determination, thresholds, input);

  // Determine if standing changed
  const standingChanged = currentStanding !== determination.standing;

  return {
    standing: determination.standing,
    previousStanding: currentStanding,
    standingChanged,
    reason,
    appliedThreshold: thresholds,
    probationTracking: {
      consecutiveTerms: determination.newConsecutiveProbationTerms,
      totalTerms: determination.newTotalProbationTerms,
      maxTermsBeforeSuspension: policy.probationMaxTerms,
      termsRemaining:
        determination.standing === "academic_probation"
          ? Math.max(0, policy.probationMaxTerms - determination.newConsecutiveProbationTerms)
          : undefined,
    },
    suspensionTracking: {
      totalSuspensions: determination.newTotalSuspensions,
      maxSuspensions: policy.maxSuspensions,
      suspensionsRemaining: Math.max(0, policy.maxSuspensions - determination.newTotalSuspensions),
    },
    actionItems,
    appealRecommended:
      determination.standing === "academic_suspension" ||
      determination.standing === "academic_dismissal",
  };
}

/**
 * Get the applicable GPA thresholds based on credits completed
 */
function getApplicableThresholds(
  policy: AcademicStandingPolicy,
  creditsCompleted: number
): {
  goodStandingMinGpa: number;
  probationMinGpa?: number;
  warningMinGpa?: number;
} {
  // If no credit-based thresholds, use the standard thresholds
  if (!policy.thresholdsByCredits || policy.thresholdsByCredits.length === 0) {
    return {
      goodStandingMinGpa: policy.goodStandingMinGpa,
      probationMinGpa: policy.probationMinGpa,
      warningMinGpa: policy.warningMinGpa,
    };
  }

  // Sort thresholds by maxCredits ascending
  const sortedThresholds = [...policy.thresholdsByCredits].sort(
    (a, b) => a.maxCredits - b.maxCredits
  );

  // Find the appropriate tier
  for (const tier of sortedThresholds) {
    if (creditsCompleted <= tier.maxCredits) {
      return {
        goodStandingMinGpa: tier.goodStandingMinGpa,
        probationMinGpa: tier.probationMinGpa,
        warningMinGpa: policy.warningMinGpa, // Warning typically not tiered
      };
    }
  }

  // If beyond all tiers, use standard thresholds
  return {
    goodStandingMinGpa: policy.goodStandingMinGpa,
    probationMinGpa: policy.probationMinGpa,
    warningMinGpa: policy.warningMinGpa,
  };
}

/**
 * Extract tracking data from previous history
 */
function getPreviousTracking(history?: StandingHistoryEntry[]): {
  consecutiveProbationTerms: number;
  totalProbationTerms: number;
  totalSuspensions: number;
} {
  if (!history || history.length === 0) {
    return {
      consecutiveProbationTerms: 0,
      totalProbationTerms: 0,
      totalSuspensions: 0,
    };
  }

  // Get the most recent entry (we know it exists since we checked length above)
  const mostRecent = history[history.length - 1]!;

  return {
    consecutiveProbationTerms: mostRecent.consecutiveProbationTerms,
    totalProbationTerms: mostRecent.totalProbationTerms,
    totalSuspensions: mostRecent.totalSuspensions,
  };
}

interface DeterminationInput {
  cumulativeGpa: number;
  thresholds: {
    goodStandingMinGpa: number;
    probationMinGpa?: number;
    warningMinGpa?: number;
  };
  currentStanding?: AcademicStandingStatus;
  consecutiveProbationTerms: number;
  totalProbationTerms: number;
  totalSuspensions: number;
  policy: AcademicStandingPolicy;
}

interface DeterminationResult {
  standing: AcademicStandingStatus;
  newConsecutiveProbationTerms: number;
  newTotalProbationTerms: number;
  newTotalSuspensions: number;
}

/**
 * Core standing determination logic
 */
function determineStanding(input: DeterminationInput): DeterminationResult {
  const {
    cumulativeGpa,
    thresholds,
    currentStanding,
    consecutiveProbationTerms,
    totalProbationTerms,
    totalSuspensions,
    policy,
  } = input;

  let newConsecutiveProbationTerms = consecutiveProbationTerms;
  let newTotalProbationTerms = totalProbationTerms;
  let newTotalSuspensions = totalSuspensions;

  // Case 1: Student is currently suspended - check if returning
  if (currentStanding === "academic_suspension") {
    // After suspension period, student returns on probation
    // (Actual suspension duration is tracked externally)
    return {
      standing: "academic_probation",
      newConsecutiveProbationTerms: 1, // Restart probation count
      newTotalProbationTerms: totalProbationTerms + 1,
      newTotalSuspensions: totalSuspensions,
    };
  }

  // Case 2: Student is dismissed - cannot return without special action
  if (currentStanding === "academic_dismissal") {
    return {
      standing: "academic_dismissal",
      newConsecutiveProbationTerms: 0,
      newTotalProbationTerms: totalProbationTerms,
      newTotalSuspensions: totalSuspensions,
    };
  }

  // Case 3: Student meets good standing GPA
  if (cumulativeGpa >= thresholds.goodStandingMinGpa) {
    // If previously on probation, return to good standing
    if (currentStanding === "academic_probation" || currentStanding === "reinstated") {
      return {
        standing: "good_standing",
        newConsecutiveProbationTerms: 0,
        newTotalProbationTerms: totalProbationTerms,
        newTotalSuspensions: totalSuspensions,
      };
    }

    return {
      standing: "good_standing",
      newConsecutiveProbationTerms: 0,
      newTotalProbationTerms: totalProbationTerms,
      newTotalSuspensions: totalSuspensions,
    };
  }

  // Case 4: Check for warning (if institution uses it)
  if (thresholds.warningMinGpa !== undefined && cumulativeGpa >= thresholds.warningMinGpa) {
    // Warning is only for first-time drops, not for probation students
    if (currentStanding === "good_standing" || !currentStanding) {
      return {
        standing: "academic_warning",
        newConsecutiveProbationTerms: 0,
        newTotalProbationTerms: totalProbationTerms,
        newTotalSuspensions: totalSuspensions,
      };
    }
  }

  // Case 5: Student is below good standing (probation territory)
  // Check if already on probation
  if (currentStanding === "academic_probation") {
    newConsecutiveProbationTerms = consecutiveProbationTerms + 1;
    newTotalProbationTerms = totalProbationTerms + 1;

    // Check if exceeded max probation terms
    if (newConsecutiveProbationTerms > policy.probationMaxTerms) {
      // Check if exceeded max suspensions
      if (totalSuspensions >= policy.maxSuspensions) {
        return {
          standing: "academic_dismissal",
          newConsecutiveProbationTerms: 0,
          newTotalProbationTerms: newTotalProbationTerms,
          newTotalSuspensions: totalSuspensions,
        };
      }

      // Suspend the student
      newTotalSuspensions = totalSuspensions + 1;
      return {
        standing: "academic_suspension",
        newConsecutiveProbationTerms: 0,
        newTotalProbationTerms: newTotalProbationTerms,
        newTotalSuspensions: newTotalSuspensions,
      };
    }

    // Continue on probation
    return {
      standing: "academic_probation",
      newConsecutiveProbationTerms: newConsecutiveProbationTerms,
      newTotalProbationTerms: newTotalProbationTerms,
      newTotalSuspensions: totalSuspensions,
    };
  }

  // Case 6: First time falling below threshold - place on probation
  // (or warning if already on warning)
  if (currentStanding === "academic_warning") {
    return {
      standing: "academic_probation",
      newConsecutiveProbationTerms: 1,
      newTotalProbationTerms: totalProbationTerms + 1,
      newTotalSuspensions: totalSuspensions,
    };
  }

  // Case 7: Going directly to probation from good standing (no warning state)
  return {
    standing: "academic_probation",
    newConsecutiveProbationTerms: 1,
    newTotalProbationTerms: totalProbationTerms + 1,
    newTotalSuspensions: totalSuspensions,
  };
}

/**
 * Generate human-readable reason for standing determination
 */
function generateReason(
  determination: DeterminationResult,
  thresholds: { goodStandingMinGpa: number; probationMinGpa?: number; warningMinGpa?: number },
  cumulativeGpa: number,
  input: AcademicStandingInput
): string {
  const gpaFormatted = cumulativeGpa.toFixed(3);
  const minGpaFormatted = thresholds.goodStandingMinGpa.toFixed(3);

  switch (determination.standing) {
    case "good_standing":
      if (input.currentStanding === "academic_probation") {
        return `Cumulative GPA of ${gpaFormatted} meets the minimum ${minGpaFormatted} required for good standing. Student has been removed from academic probation.`;
      }
      return `Cumulative GPA of ${gpaFormatted} meets the minimum ${minGpaFormatted} required for good standing.`;

    case "academic_warning":
      return `Cumulative GPA of ${gpaFormatted} is below the ${minGpaFormatted} required for good standing. This is an academic warning - continued decline may result in academic probation.`;

    case "academic_probation":
      if (input.currentStanding === "academic_suspension") {
        return `Student is returning from academic suspension on probation. Cumulative GPA of ${gpaFormatted} is below the minimum ${minGpaFormatted}.`;
      }
      if (input.currentStanding === "academic_probation") {
        return `Student remains on academic probation. Cumulative GPA of ${gpaFormatted} is still below the minimum ${minGpaFormatted}. This is probation term ${determination.newConsecutiveProbationTerms} of ${input.policy.probationMaxTerms} allowed.`;
      }
      return `Cumulative GPA of ${gpaFormatted} is below the ${minGpaFormatted} minimum for good standing. Student has been placed on academic probation.`;

    case "academic_suspension":
      return `Student has exceeded the maximum ${input.policy.probationMaxTerms} terms on academic probation without meeting the ${minGpaFormatted} GPA requirement. Academic suspension for ${input.policy.suspensionDurationTerms} term(s).`;

    case "academic_dismissal":
      return `Student has exceeded the maximum ${input.policy.maxSuspensions} academic suspensions. Academic dismissal is in effect.`;

    case "reinstated":
      return `Student has been reinstated following an approved appeal.`;

    default:
      return `Academic standing determined based on cumulative GPA of ${gpaFormatted}.`;
  }
}

/**
 * Generate action items based on standing
 */
function generateActionItems(
  determination: DeterminationResult,
  thresholds: { goodStandingMinGpa: number; probationMinGpa?: number; warningMinGpa?: number },
  input: AcademicStandingInput
): string[] {
  const items: string[] = [];
  const gpaNeeded = (thresholds.goodStandingMinGpa - input.cumulativeGpa).toFixed(3);

  switch (determination.standing) {
    case "good_standing":
      if (input.currentStanding === "academic_probation") {
        items.push("Congratulations on returning to good academic standing!");
        items.push("Continue to maintain your GPA at or above the minimum requirement.");
      }
      break;

    case "academic_warning":
      items.push("Schedule a meeting with your academic advisor immediately.");
      items.push(`Your GPA needs to improve by ${gpaNeeded} points to return to good standing.`);
      items.push("Consider utilizing tutoring services and academic support resources.");
      items.push("Review your course load and consider adjustments if needed.");
      break;

    case "academic_probation":
      items.push("Schedule a mandatory meeting with your academic advisor.");
      items.push("Develop an academic success plan with specific goals.");
      items.push(`You must raise your GPA by ${gpaNeeded} points to return to good standing.`);
      items.push("Utilize all available academic support services (tutoring, study groups, etc.).");
      if (determination.newConsecutiveProbationTerms >= input.policy.probationMaxTerms - 1) {
        items.push(
          "WARNING: This is your final probation term. Failure to meet requirements will result in academic suspension."
        );
      }
      break;

    case "academic_suspension":
      items.push("You have been academically suspended and cannot enroll for the suspension period.");
      items.push("You may submit an appeal to the Academic Standards Committee.");
      items.push("Contact the Registrar's Office for information on the reinstatement process.");
      items.push("Consider using this time to address any personal or academic challenges.");
      break;

    case "academic_dismissal":
      items.push("You have been academically dismissed from the institution.");
      items.push("You may submit an appeal for readmission to the Academic Standards Committee.");
      items.push("Contact the Admissions Office for information on future reapplication.");
      break;

    case "reinstated":
      items.push("You have been reinstated following your appeal.");
      items.push("Adhere to all conditions specified in your reinstatement approval.");
      items.push("Meet with your academic advisor to review your academic plan.");
      break;
  }

  return items;
}

/**
 * Check if a student's GPA would qualify for good standing
 * Utility function for "what-if" calculations
 */
export function wouldBeInGoodStanding(
  gpa: number,
  creditsCompleted: number,
  policy: AcademicStandingPolicy
): boolean {
  const thresholds = getApplicableThresholds(policy, creditsCompleted);
  return gpa >= thresholds.goodStandingMinGpa;
}

/**
 * Calculate the minimum GPA needed for good standing
 */
export function getMinimumGpaForGoodStanding(
  creditsCompleted: number,
  policy: AcademicStandingPolicy
): number {
  const thresholds = getApplicableThresholds(policy, creditsCompleted);
  return thresholds.goodStandingMinGpa;
}

/**
 * Calculate what GPA is needed next term to reach good standing
 * Given current cumulative values and expected credits
 */
export function calculateRequiredTermGpa(
  currentCumulativeGpa: number,
  currentQualityPoints: number,
  currentGpaCredits: number,
  nextTermCredits: number,
  targetGpa: number
): number | null {
  // Required total quality points to reach target GPA
  const totalCreditsAfter = currentGpaCredits + nextTermCredits;
  const requiredTotalQualityPoints = targetGpa * totalCreditsAfter;

  // Quality points needed this term
  const requiredTermQualityPoints = requiredTotalQualityPoints - currentQualityPoints;

  // Calculate required term GPA
  const requiredTermGpa = requiredTermQualityPoints / nextTermCredits;

  // If required GPA exceeds 4.0 (assuming standard scale), it's not achievable
  if (requiredTermGpa > 4.0) {
    return null; // Not achievable in one term
  }

  return Math.max(0, requiredTermGpa);
}

/**
 * Get standing display name
 */
export function getStandingDisplayName(standing: AcademicStandingStatus): string {
  const displayNames: Record<AcademicStandingStatus, string> = {
    good_standing: "Good Standing",
    academic_warning: "Academic Warning",
    academic_probation: "Academic Probation",
    academic_suspension: "Academic Suspension",
    academic_dismissal: "Academic Dismissal",
    reinstated: "Reinstated",
  };

  return displayNames[standing] || standing;
}

/**
 * Get standing severity level (for sorting/display)
 */
export function getStandingSeverity(standing: AcademicStandingStatus): number {
  const severities: Record<AcademicStandingStatus, number> = {
    good_standing: 0,
    reinstated: 1,
    academic_warning: 2,
    academic_probation: 3,
    academic_suspension: 4,
    academic_dismissal: 5,
  };

  return severities[standing] ?? 0;
}
