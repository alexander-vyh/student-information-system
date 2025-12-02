/**
 * Academic Standing Module
 *
 * Pure TypeScript implementation for calculating and managing
 * student academic standing determinations.
 */

// Types
export type {
  AcademicStandingStatus,
  CreditBasedThreshold,
  AcademicStandingPolicy,
  StandingHistoryEntry,
  AcademicStandingInput,
  AcademicStandingResult,
  BatchCalculationOptions,
  BatchCalculationResult,
} from "./types.js";

// Calculator functions
export {
  calculateAcademicStanding,
  wouldBeInGoodStanding,
  getMinimumGpaForGoodStanding,
  calculateRequiredTermGpa,
  getStandingDisplayName,
  getStandingSeverity,
} from "./calculator.js";
