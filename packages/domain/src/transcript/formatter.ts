/**
 * Transcript Formatter
 *
 * Pure formatting functions for transcript display.
 * No dependencies - fully testable.
 */

interface NameParts {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}

/**
 * Format student name for transcript (Last, First Middle, Suffix)
 */
export function formatStudentName(name: NameParts): string {
  const parts: string[] = [name.lastName];

  // Add first and middle name
  if (name.middleName) {
    parts.push(`${name.firstName} ${name.middleName}`);
  } else {
    parts.push(name.firstName);
  }

  // Add suffix if present
  if (name.suffix) {
    return `${parts.join(", ")}, ${name.suffix}`;
  }

  return parts.join(", ");
}

/**
 * Format GPA to 3 decimal places
 */
export function formatGpa(gpa: number | null | undefined): string {
  if (gpa === null || gpa === undefined) {
    return "N/A";
  }

  return gpa.toFixed(3);
}

/**
 * Format former names for "Formerly known as" section
 */
export function formatFormerNames(formerNames: string[]): string | null {
  // Filter out empty strings
  const validNames = formerNames.filter((name) => name.trim().length > 0);

  if (validNames.length === 0) {
    return null;
  }

  return `Formerly known as: ${validNames.join("; ")}`;
}

/**
 * Format date as MM/DD/YYYY
 * Uses UTC to avoid timezone issues
 */
export function formatDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${month}/${day}/${year}`;
}

/**
 * Format credits to 1 decimal place
 */
export function formatCredits(credits: number): string {
  return credits.toFixed(1);
}
