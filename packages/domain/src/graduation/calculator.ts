/**
 * Graduation Domain Calculator
 *
 * Pure business logic for graduation eligibility, Latin honors calculation,
 * and conferral validation. No database dependencies.
 */

import {
  LatinHonorsConfig,
  LatinHonorsDesignation,
  LatinHonorsInput,
  LatinHonorsResult,
  GraduationEligibilityInput,
  GraduationValidationResult,
  AcademicRequirementsStatus,
  AdministrativeClearanceStatus,
  DataValidationStatus,
  GraduationPolicyConfig,
  DEFAULT_GRADUATION_POLICY,
  BatchConferralStudentInput,
  BatchConferralStudentResult,
} from "./types.js";

/**
 * Calculate Latin honors designation based on GPA and eligibility criteria
 *
 * @param input - Student academic data
 * @param config - Latin honors thresholds and rules
 * @returns Latin honors result with designation and explanation
 */
export function calculateLatinHonors(
  input: LatinHonorsInput,
  config: LatinHonorsConfig
): LatinHonorsResult {
  // Check academic integrity disqualification
  if (config.disqualifyForAcademicIntegrity && input.hasAcademicIntegrityViolation) {
    return {
      designation: null,
      gpaUsed: input.cumulativeGpa,
      meetsCreditsRequirement: input.earnedCredits >= config.minimumCredits,
      meetsInstitutionalCreditsRequirement:
        input.institutionalCredits >= config.minimumInstitutionalCredits,
      disqualifiedForIntegrity: true,
      explanation: "Disqualified from Latin honors due to academic integrity violation",
    };
  }

  // Check credit requirements
  const meetsCreditsRequirement = input.earnedCredits >= config.minimumCredits;
  const meetsInstitutionalCreditsRequirement =
    input.institutionalCredits >= config.minimumInstitutionalCredits;

  if (!meetsCreditsRequirement) {
    return {
      designation: null,
      gpaUsed: input.cumulativeGpa,
      meetsCreditsRequirement: false,
      meetsInstitutionalCreditsRequirement,
      disqualifiedForIntegrity: false,
      explanation: `Requires minimum ${config.minimumCredits} credits; student has ${input.earnedCredits}`,
    };
  }

  if (!meetsInstitutionalCreditsRequirement) {
    return {
      designation: null,
      gpaUsed: input.cumulativeGpa,
      meetsCreditsRequirement: true,
      meetsInstitutionalCreditsRequirement: false,
      disqualifiedForIntegrity: false,
      explanation: `Requires minimum ${config.minimumInstitutionalCredits} institutional credits; student has ${input.institutionalCredits}`,
    };
  }

  // Determine which GPA to use
  const gpaUsed = config.excludeTransferCredits && input.institutionalGpa !== undefined
    ? input.institutionalGpa
    : input.cumulativeGpa;

  // Determine honors level based on GPA
  let designation: LatinHonorsDesignation = null;
  let explanation: string;

  if (gpaUsed >= config.summaThreshold) {
    designation = "summa_cum_laude";
    explanation = `GPA ${gpaUsed.toFixed(3)} meets summa cum laude threshold (${config.summaThreshold})`;
  } else if (gpaUsed >= config.magnaThreshold) {
    designation = "magna_cum_laude";
    explanation = `GPA ${gpaUsed.toFixed(3)} meets magna cum laude threshold (${config.magnaThreshold})`;
  } else if (gpaUsed >= config.cumThreshold) {
    designation = "cum_laude";
    explanation = `GPA ${gpaUsed.toFixed(3)} meets cum laude threshold (${config.cumThreshold})`;
  } else {
    explanation = `GPA ${gpaUsed.toFixed(3)} does not meet minimum honors threshold (${config.cumThreshold})`;
  }

  return {
    designation,
    gpaUsed,
    meetsCreditsRequirement: true,
    meetsInstitutionalCreditsRequirement: true,
    disqualifiedForIntegrity: false,
    explanation,
  };
}

/**
 * Format Latin honors designation for display
 *
 * @param designation - The honors designation
 * @returns Formatted string for display (e.g., "Summa Cum Laude")
 */
export function formatLatinHonors(designation: LatinHonorsDesignation): string {
  switch (designation) {
    case "summa_cum_laude":
      return "Summa Cum Laude";
    case "magna_cum_laude":
      return "Magna Cum Laude";
    case "cum_laude":
      return "Cum Laude";
    default:
      return "";
  }
}

/**
 * Check academic requirements for graduation
 *
 * @param input - Student academic data
 * @param policy - Graduation policy configuration
 * @returns Academic requirements status
 */
export function checkAcademicRequirements(
  input: GraduationEligibilityInput,
  policy: GraduationPolicyConfig = DEFAULT_GRADUATION_POLICY
): AcademicRequirementsStatus {
  const missingRequirements: string[] = [];

  // Check degree audit completion
  const allRequiredCoursesComplete =
    input.degreeAudit.completionPct >= 100 && input.degreeAudit.allRequirementsComplete;
  if (!allRequiredCoursesComplete) {
    missingRequirements.push(
      `Degree audit ${input.degreeAudit.completionPct.toFixed(1)}% complete`
    );
    if (input.degreeAudit.missingRequirements.length > 0) {
      missingRequirements.push(
        ...input.degreeAudit.missingRequirements.map((r) => `Missing: ${r}`)
      );
    }
  }

  // Check total credits
  const allCreditsEarned = input.credits.totalEarned >= policy.minimumCredits;
  if (!allCreditsEarned) {
    missingRequirements.push(
      `Need ${policy.minimumCredits} credits; have ${input.credits.totalEarned}`
    );
  }

  // Check GPA
  const gpaRequirementsMet = input.gpa.cumulative >= policy.minimumGpa;
  if (!gpaRequirementsMet) {
    missingRequirements.push(
      `Need ${policy.minimumGpa.toFixed(2)} GPA; have ${input.gpa.cumulative.toFixed(3)}`
    );
  }

  // Check residency
  const residencyRequirementMet =
    input.credits.institutionalEarned >= policy.minimumInstitutionalCredits;
  if (!residencyRequirementMet) {
    missingRequirements.push(
      `Need ${policy.minimumInstitutionalCredits} institutional credits; have ${input.credits.institutionalEarned}`
    );
  }

  // Check incomplete grades
  const noIncompleteGrades = !input.grades.hasIncompleteGrades;
  if (!noIncompleteGrades) {
    missingRequirements.push(`${input.grades.incompleteCount} incomplete grade(s) must be resolved`);
  }

  // Check pending grades
  const noPendingFinalGrades = !input.grades.hasPendingFinalGrades;
  if (!noPendingFinalGrades) {
    missingRequirements.push(`${input.grades.pendingCount} pending final grade(s)`);
  }

  // Check milestones
  const milestonesComplete =
    input.requirements.milestonesRequired.length === 0 ||
    input.requirements.milestonesRequired.every((m) =>
      input.requirements.milestonesCompleted.includes(m)
    );
  if (!milestonesComplete) {
    const missing = input.requirements.milestonesRequired.filter(
      (m) => !input.requirements.milestonesCompleted.includes(m)
    );
    missingRequirements.push(...missing.map((m) => `Milestone not complete: ${m}`));
  }

  return {
    degreeAuditCompletionPct: input.degreeAudit.completionPct,
    allRequiredCoursesComplete,
    allCreditsEarned,
    gpaRequirementsMet,
    residencyRequirementMet,
    noIncompleteGrades,
    noPendingFinalGrades,
    milestonesComplete,
    missingRequirements,
  };
}

/**
 * Check administrative clearances for graduation
 *
 * @param input - Student administrative data
 * @param policy - Graduation policy configuration
 * @returns Administrative clearance status
 */
export function checkAdministrativeClearances(
  input: GraduationEligibilityInput,
  policy: GraduationPolicyConfig = DEFAULT_GRADUATION_POLICY
): AdministrativeClearanceStatus {
  // Filter holds that block graduation
  const graduationBlockingHolds = input.holds;
  const noBlockingHolds = graduationBlockingHolds.length === 0;

  // Check financial clearance
  const financialClearance = input.financialBalance <= policy.maxFinancialBalance;

  // Library clearance
  const libraryClearance = !policy.requireLibraryClearance || input.libraryClearance;

  // Department clearance
  const departmentClearance = !policy.requireDepartmentClearance || input.departmentClearance;

  // Exit counseling
  const exitCounselingComplete =
    !policy.requireExitCounseling ||
    !input.exitCounselingRequired ||
    input.exitCounselingComplete;

  // SEVIS (for international students only)
  const sevisUpdated = input.isInternational ? (input.sevisUpdated ?? false) : null;

  return {
    noBlockingHolds,
    financialClearance,
    libraryClearance,
    departmentClearance,
    exitCounselingComplete,
    sevisUpdated,
    blockingHolds: graduationBlockingHolds,
    outstandingBalance: input.financialBalance > 0 ? input.financialBalance : undefined,
  };
}

/**
 * Check data validation for graduation
 *
 * @param input - Student data
 * @returns Data validation status
 */
export function checkDataValidation(
  input: GraduationEligibilityInput
): DataValidationStatus {
  const missingFields: string[] = [];

  const diplomaNameVerified = input.diplomaName !== null && input.diplomaName.trim().length > 0;
  if (!diplomaNameVerified) {
    missingFields.push("Diploma name not verified");
  }

  const mailingAddressConfirmed = input.mailingAddress !== null;
  if (!mailingAddressConfirmed) {
    missingFields.push("Mailing address not confirmed");
  }

  const declarationsComplete = input.majorDeclared;
  if (!declarationsComplete) {
    missingFields.push("Major/minor declaration incomplete");
  }

  // Program record completeness is assumed if major is declared
  const programRecordComplete = declarationsComplete;

  // Honors calculation is a separate step, assume false until calculated
  const honorsCalculated = false;

  return {
    diplomaNameVerified,
    mailingAddressConfirmed,
    programRecordComplete,
    declarationsComplete,
    honorsCalculated,
    missingFields,
  };
}

/**
 * Validate graduation eligibility
 *
 * Performs comprehensive check of all graduation requirements including
 * academic, administrative, and data validation requirements.
 *
 * @param input - Student data for eligibility check
 * @param policy - Graduation policy configuration
 * @returns Complete graduation validation result
 */
export function validateGraduationEligibility(
  input: GraduationEligibilityInput,
  policy: GraduationPolicyConfig = DEFAULT_GRADUATION_POLICY
): GraduationValidationResult {
  const academicChecks = checkAcademicRequirements(input, policy);
  const administrativeChecks = checkAdministrativeClearances(input, policy);
  const dataValidation = checkDataValidation(input);

  // Collect all blockers
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Academic blockers
  blockers.push(...academicChecks.missingRequirements);

  // Administrative blockers
  if (!administrativeChecks.noBlockingHolds) {
    administrativeChecks.blockingHolds.forEach((hold) => {
      blockers.push(`${hold.holdName} (${hold.holdCode}) - Contact: ${hold.releaseAuthority}`);
    });
  }
  if (!administrativeChecks.financialClearance) {
    blockers.push(
      `Outstanding balance: $${administrativeChecks.outstandingBalance?.toFixed(2) ?? "0.00"}`
    );
  }
  if (!administrativeChecks.libraryClearance) {
    blockers.push("Library clearance required");
  }
  if (!administrativeChecks.departmentClearance) {
    blockers.push("Department clearance required");
  }
  if (!administrativeChecks.exitCounselingComplete) {
    blockers.push("Exit counseling not complete");
  }
  if (administrativeChecks.sevisUpdated === false) {
    blockers.push("SEVIS record update required for international students");
  }

  // Data validation warnings (non-blocking for eligibility check)
  warnings.push(...dataValidation.missingFields);

  // Determine overall eligibility
  const isEligible =
    academicChecks.allRequiredCoursesComplete &&
    academicChecks.allCreditsEarned &&
    academicChecks.gpaRequirementsMet &&
    academicChecks.residencyRequirementMet &&
    academicChecks.noIncompleteGrades &&
    academicChecks.milestonesComplete &&
    administrativeChecks.noBlockingHolds &&
    administrativeChecks.financialClearance &&
    administrativeChecks.libraryClearance &&
    administrativeChecks.departmentClearance &&
    administrativeChecks.exitCounselingComplete &&
    (administrativeChecks.sevisUpdated === null || administrativeChecks.sevisUpdated);

  return {
    isEligible,
    validationDate: new Date(),
    academicChecks,
    administrativeChecks,
    dataValidation,
    blockers,
    warnings,
  };
}

/**
 * Check if a student can be conferred (final pre-conferral check)
 *
 * This is a stricter check than eligibility - also requires data validation.
 *
 * @param input - Student data
 * @param policy - Graduation policy configuration
 * @returns Whether conferral can proceed and any blockers
 */
export function canConfer(
  input: GraduationEligibilityInput,
  policy: GraduationPolicyConfig = DEFAULT_GRADUATION_POLICY
): { canConfer: boolean; blockers: string[] } {
  const validation = validateGraduationEligibility(input, policy);
  const allBlockers = [...validation.blockers];

  // For conferral, data validation issues become blockers
  if (!validation.dataValidation.diplomaNameVerified) {
    allBlockers.push("Diploma name must be verified before conferral");
  }
  if (!validation.dataValidation.mailingAddressConfirmed) {
    allBlockers.push("Mailing address must be confirmed before conferral");
  }
  if (!validation.dataValidation.programRecordComplete) {
    allBlockers.push("Program record must be complete before conferral");
  }

  return {
    canConfer: allBlockers.length === 0,
    blockers: allBlockers,
  };
}

/**
 * Process batch conferral for multiple students
 *
 * @param students - List of students to confer
 * @param conferralDate - Date of conferral
 * @param latinHonorsConfig - Latin honors configuration
 * @returns Results for each student
 */
export function processBatchConferral(
  students: BatchConferralStudentInput[],
  conferralDate: Date,
  latinHonorsConfig: LatinHonorsConfig
): BatchConferralStudentResult[] {
  return students.map((student) => {
    // Calculate Latin honors
    const honorsInput: LatinHonorsInput = {
      cumulativeGpa: student.gpa.cumulative,
      institutionalGpa: student.gpa.institutional,
      earnedCredits: student.credits.totalEarned,
      institutionalCredits: student.credits.institutionalEarned,
      transferCredits: student.credits.transferCredits,
      hasAcademicIntegrityViolation: student.hasAcademicIntegrityViolation,
    };

    const honorsResult = calculateLatinHonors(honorsInput, latinHonorsConfig);

    return {
      studentId: student.studentId,
      studentProgramId: student.studentProgramId,
      graduationApplicationId: student.graduationApplicationId,
      status: "conferred" as const,
      degreeAwarded: `${student.degreeCode} in ${student.programName}`,
      conferralDate,
      honorsDesignation: honorsResult.designation,
    };
  });
}

/**
 * Calculate expected graduation term based on credits and enrollment pattern
 *
 * @param currentCredits - Credits currently earned
 * @param requiredCredits - Credits required for graduation
 * @param creditsPerTerm - Average credits per term
 * @param currentTermNumber - Current term number (1 = Fall, 2 = Spring, 3 = Summer)
 * @param currentYear - Current year
 * @returns Expected graduation term string (e.g., "Spring 2026")
 */
export function calculateExpectedGraduationTerm(
  currentCredits: number,
  requiredCredits: number,
  creditsPerTerm: number = 15,
  currentTermNumber: number,
  currentYear: number
): string {
  const remainingCredits = Math.max(0, requiredCredits - currentCredits);
  const remainingTerms = Math.ceil(remainingCredits / creditsPerTerm);

  // Calculate target term
  let termNumber = currentTermNumber;
  let year = currentYear;

  for (let i = 0; i < remainingTerms; i++) {
    termNumber++;
    if (termNumber > 3) {
      termNumber = 1;
      year++;
    }
  }

  const termNames = ["", "Fall", "Spring", "Summer"];
  return `${termNames[termNumber]} ${year}`;
}

/**
 * Generate diploma number
 *
 * @param institutionCode - Institution code
 * @param year - Conferral year
 * @param sequence - Sequence number for this year
 * @returns Formatted diploma number
 */
export function generateDiplomaNumber(
  institutionCode: string,
  year: number,
  sequence: number
): string {
  const paddedSequence = sequence.toString().padStart(6, "0");
  return `${institutionCode}-${year}-${paddedSequence}`;
}
