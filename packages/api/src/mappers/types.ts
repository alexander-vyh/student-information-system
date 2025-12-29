/**
 * Common Type Mappers
 *
 * Utilities for transforming database types to domain types.
 * Centralizes common patterns like decimal parsing.
 */

// =============================================================================
// Decimal Parsing
// =============================================================================

/**
 * Parse a decimal string field to a number.
 * Drizzle returns decimal columns as strings to preserve precision.
 *
 * @param value - The string value from database (may be null/undefined)
 * @param defaultValue - Default if null/undefined (default: 0)
 * @returns Parsed number
 *
 * @example
 * // In router:
 * const gpa = parseDecimal(gpaSummary.cumulativeGpa, 0);
 */
export function parseDecimal(
  value: string | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a decimal to a fixed-precision number.
 * Useful for GPA (2 decimals) and credit hours (1 decimal).
 *
 * @param value - The string value from database
 * @param precision - Number of decimal places
 * @param defaultValue - Default if null/undefined
 */
export function parseDecimalFixed(
  value: string | null | undefined,
  precision: number,
  defaultValue: number = 0
): number {
  const parsed = parseDecimal(value, defaultValue);
  return Number(parsed.toFixed(precision));
}

// =============================================================================
// Integer Parsing
// =============================================================================

/**
 * Parse an integer field to a number.
 * Some database drivers return bigint/numeric as strings.
 */
export function parseInteger(
  value: string | number | bigint | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === "number") {
    return Math.floor(value);
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// =============================================================================
// Date Helpers
// =============================================================================

/**
 * Convert a database date to ISO string.
 * Handles null/undefined gracefully.
 */
export function toISOString(
  date: Date | string | null | undefined
): string | null {
  if (!date) return null;
  if (date instanceof Date) return date.toISOString();
  return date;
}

/**
 * Format a date for display (YYYY-MM-DD).
 */
export function toDateString(
  date: Date | string | null | undefined
): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0] ?? null;
}

// =============================================================================
// Null Coalescing
// =============================================================================

/**
 * Return value or default, with type narrowing.
 * More explicit than nullish coalescing for documentation.
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

/**
 * Map an optional value through a transform function.
 * Returns null if input is null/undefined.
 */
export function mapOptional<T, U>(
  value: T | null | undefined,
  fn: (v: T) => U
): U | null {
  if (value === null || value === undefined) return null;
  return fn(value);
}
