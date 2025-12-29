/**
 * Transcript Formatter Tests
 *
 * Test-driven development: write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import {
  formatStudentName,
  formatGpa,
  formatFormerNames,
  formatDate,
  formatCredits,
} from "./formatter.js";

describe("formatStudentName", () => {
  it("should format full name with middle name and suffix", () => {
    const result = formatStudentName({
      firstName: "John",
      middleName: "Robert",
      lastName: "Smith",
      suffix: "Jr.",
    });
    expect(result).toBe("Smith, John Robert, Jr.");
  });

  it("should format name without middle name", () => {
    const result = formatStudentName({
      firstName: "Jane",
      middleName: null,
      lastName: "Doe",
      suffix: null,
    });
    expect(result).toBe("Doe, Jane");
  });

  it("should format name with middle name but no suffix", () => {
    const result = formatStudentName({
      firstName: "Mary",
      middleName: "Anne",
      lastName: "Johnson",
      suffix: null,
    });
    expect(result).toBe("Johnson, Mary Anne");
  });

  it("should format name with suffix but no middle name", () => {
    const result = formatStudentName({
      firstName: "Robert",
      middleName: null,
      lastName: "Williams",
      suffix: "III",
    });
    expect(result).toBe("Williams, Robert, III");
  });
});

describe("formatGpa", () => {
  it("should format GPA to 3 decimal places", () => {
    expect(formatGpa(3.456789)).toBe("3.457");
  });

  it("should handle perfect 4.0 GPA", () => {
    expect(formatGpa(4.0)).toBe("4.000");
  });

  it("should handle low GPA", () => {
    expect(formatGpa(2.1)).toBe("2.100");
  });

  it("should return 'N/A' for null GPA", () => {
    expect(formatGpa(null)).toBe("N/A");
  });

  it("should return 'N/A' for undefined GPA", () => {
    expect(formatGpa(undefined)).toBe("N/A");
  });

  it("should round correctly at .5", () => {
    expect(formatGpa(3.4445)).toBe("3.445");
    expect(formatGpa(3.4444)).toBe("3.444");
  });
});

describe("formatFormerNames", () => {
  it("should format single former name", () => {
    const result = formatFormerNames(["Smith, Jane"]);
    expect(result).toBe("Formerly known as: Smith, Jane");
  });

  it("should format multiple former names", () => {
    const result = formatFormerNames(["Smith, Jane", "Johnson, Jane Marie"]);
    expect(result).toBe("Formerly known as: Smith, Jane; Johnson, Jane Marie");
  });

  it("should return null for empty array", () => {
    const result = formatFormerNames([]);
    expect(result).toBeNull();
  });

  it("should return null for empty former names", () => {
    const result = formatFormerNames([""]);
    expect(result).toBeNull();
  });
});

describe("formatDate", () => {
  it("should format date as MM/DD/YYYY", () => {
    const date = new Date("2025-03-15");
    expect(formatDate(date)).toBe("03/15/2025");
  });

  it("should handle single-digit month and day", () => {
    const date = new Date("2025-01-05");
    expect(formatDate(date)).toBe("01/05/2025");
  });

  it("should handle December date", () => {
    const date = new Date("2024-12-31");
    expect(formatDate(date)).toBe("12/31/2024");
  });
});

describe("formatCredits", () => {
  it("should format whole number credits without decimals", () => {
    expect(formatCredits(3.0)).toBe("3.0");
  });

  it("should format fractional credits to 1 decimal", () => {
    expect(formatCredits(3.5)).toBe("3.5");
  });

  it("should format to 1 decimal even for more precision", () => {
    expect(formatCredits(3.33)).toBe("3.3");
  });

  it("should handle zero credits", () => {
    expect(formatCredits(0)).toBe("0.0");
  });
});
