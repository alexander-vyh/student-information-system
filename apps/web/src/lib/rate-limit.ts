/**
 * In-Memory Rate Limiter for Edge Runtime
 *
 * Implements a sliding window rate limiter using a Map.
 * For production with multiple instances, replace with Redis-based solution.
 *
 * Note: This implementation is suitable for:
 * - Single-instance deployments
 * - Development environments
 * - Edge runtime (Vercel, Cloudflare Workers)
 *
 * For distributed deployments, use @upstash/ratelimit with Upstash Redis
 * or implement a Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limit entries
// Key format: `${identifier}:${windowKey}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 60 seconds)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000;

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the rate limit resets */
  reset: number;
  /** Maximum requests allowed per window */
  limit: number;
}

/**
 * Check rate limit for an identifier
 *
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries();

  const now = Date.now();
  const windowKey = Math.floor(now / (config.windowSeconds * 1000));
  const key = `${identifier}:${windowKey}`;
  const resetTime = (windowKey + 1) * config.windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  const success = entry.count <= config.limit;
  const remaining = Math.max(0, config.limit - entry.count);

  return {
    success,
    remaining,
    reset: entry.resetTime,
    limit: config.limit,
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /**
   * Authentication rate limiter
   * 5 attempts per 15 minutes per IP
   */
  auth: (identifier: string) =>
    checkRateLimit(identifier, { limit: 5, windowSeconds: 15 * 60 }),

  /**
   * API rate limiter
   * 100 requests per minute per IP
   */
  api: (identifier: string) =>
    checkRateLimit(identifier, { limit: 100, windowSeconds: 60 }),

  /**
   * Strict rate limiter for sensitive operations
   * 3 attempts per hour
   */
  strict: (identifier: string) =>
    checkRateLimit(identifier, { limit: 3, windowSeconds: 60 * 60 }),
};

/**
 * Get client IP from request headers
 * Works with most CDNs and proxies
 */
export function getClientIp(request: Request): string {
  // Check common headers in order of preference
  const headers = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // Nginx proxy
    "x-forwarded-for", // Standard proxy header
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs; take the first one
      const ip = value.split(",")[0]?.trim();
      if (ip) return ip;
    }
  }

  // Fallback - use a hash of other identifying info
  return "unknown";
}
