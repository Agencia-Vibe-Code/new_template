/**
 * Redis-backed rate limiter using a fixed window strategy.
 *
 * Requirements:
 * - Set REDIS_URL (e.g., redis://user:pass@host:port/db)
 *
 * Returns success/remaining/resetAt (ms timestamp).
 */
import Redis from "ioredis";

type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

const redisPrefix = "ratelimit";
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "Rate limit exige REDIS_URL (ex: redis://user:pass@host:port/db)"
    );
  }

  redisClient = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  redisClient.on("error", (err) => {
    console.error("[rate-limit] Redis error:", err);
  });

  return redisClient;
}

/**
 * Fixed-window limiter: counts hits per (key, windowId).
 * Window resets every `windowMs`. TTL is set on first write.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }

  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const redisKey = `${redisPrefix}:${key}:${windowId}`;

  const pipeline = redis.multi();
  pipeline.set(redisKey, "0", "PX", windowMs, "NX");
  pipeline.incr(redisKey);
  pipeline.pttl(redisKey);

  const [, incrResult, ttlResult] = (await pipeline.exec()) ?? [];
  const count = typeof incrResult?.[1] === "number" ? incrResult[1] : 0;
  let ttl = typeof ttlResult?.[1] === "number" ? ttlResult[1] : windowMs;

  if (ttl < 0) {
    // Key exists without TTL; ensure it expires.
    await redis.pexpire(redisKey, windowMs);
    ttl = windowMs;
  }

  const success = count <= limit;
  const remaining = Math.max(0, limit - count);
  const resetAt = now + ttl;

  return { success, remaining, resetAt };
}

/**
 * Clear a specific rate-limit key (test helper).
 */
export async function clearRateLimit(key: string, windowMs: number): Promise<void> {
  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }

  const windowId = Math.floor(Date.now() / windowMs);
  const redisKey = `${redisPrefix}:${key}:${windowId}`;
  await redis.del(redisKey);
}
