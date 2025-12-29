/**
 * Password Hashing Utilities
 *
 * Uses bcryptjs for secure password hashing.
 * Cost factor of 12 balances security and performance.
 */

import bcrypt from "bcryptjs";

/**
 * bcrypt cost factor (work factor)
 * 12 is a good balance between security and performance
 * Approximately 200-400ms on modern hardware
 */
const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password
 *
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash
 *
 * @param password - The plaintext password to verify
 * @param hash - The stored bcrypt hash
 * @returns true if the password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string | null
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Check if a hash needs to be upgraded (cost factor increased)
 * Call this after successful login to check if rehashing is needed
 *
 * @param hash - The stored hash to check
 * @returns true if the hash should be upgraded
 */
export function needsRehash(hash: string): boolean {
  // bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
  // Format: $2b$12$... where 12 is the cost factor
  const match = hash.match(/^\$2[aby]\$(\d+)\$/);
  if (!match || !match[1]) return true; // Not a valid bcrypt hash

  const currentRounds = parseInt(match[1], 10);
  return currentRounds < BCRYPT_ROUNDS;
}
