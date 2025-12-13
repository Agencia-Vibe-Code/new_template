/**
 * Basic rate limiting implementation for development.
 * 
 * ⚠️ WARNING: This is an in-memory implementation and will not work
 * across multiple server instances. For production, use a proper
 * rate limiting solution like:
 * - @upstash/ratelimit with Redis
 * - Vercel KV
 * - Other distributed rate limiting solutions
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (development only)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Validates that rate limiting is properly configured for the environment.
 * Throws an error in production if distributed rate limiting is not available.
 */
function validateRateLimitConfig(): void {
  if (process.env.NODE_ENV === "production") {
    const hasRedis = !!(
      process.env.REDIS_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL ||
      process.env.KV_URL
    );

    if (!hasRedis) {
      throw new Error(
        "Rate limiting in production requires a distributed storage solution. " +
        "Please configure one of the following:\n" +
        "  - REDIS_URL (for Redis)\n" +
        "  - UPSTASH_REDIS_REST_URL (for Upstash Redis)\n" +
        "  - KV_REST_API_URL or KV_URL (for Vercel KV)\n\n" +
        "For development, this in-memory implementation is acceptable, " +
        "but it will not work correctly with multiple server instances."
      );
    }
  }
}

/**
 * Simple rate limiter using sliding window algorithm
 * @param key - Unique identifier for the rate limit (e.g., user ID)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with success status and remaining requests
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  // Validate configuration in production
  validateRateLimitConfig();
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      success: true,
      remaining: limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Clear rate limit for a specific key (useful for testing)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Clean up expired entries (should be called periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

