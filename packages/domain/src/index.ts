/**
 * @sis/domain - Pure TypeScript domain logic
 *
 * This package contains business logic with no external dependencies.
 * All functions are pure and fully testable with unit tests.
 */

// Common utilities (Result type, errors)
export * from "./common/index.js";

// GPA Calculation
export * from "./gpa/index.js";

// Satisfactory Academic Progress (SAP)
export * from "./sap/index.js";

// Return to Title IV (R2T4)
export * from "./r2t4/index.js";

// Degree Audit / Progress Tracking
export * from "./degree-audit/index.js";

// Academic Standing
export * from "./academic-standing/index.js";

// Graduation / Conferral
export * from "./graduation/index.js";
