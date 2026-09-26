import "server-only";
import { HttpError } from "./http";

/**
 * Token-bucket rate limiter. In-memory per server instance, which is enough
 * to blunt abuse on a single region deployment; swap for Upstash/Redis if you
 * scale out (same interface).
 */
interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { capacity: number; refillPerSec: number }) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: opts.capacity, updated: now };
  b.tokens = Math.min(opts.capacity, b.tokens + ((now - b.updated) / 1000) * opts.refillPerSec);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new HttpError(429, "slow down");
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) {
    // crude cleanup of stale buckets
    for (const [k, v] of buckets) if (now - v.updated > 600_000) buckets.delete(k);
  }
}

export const RATE = {
  publish: { capacity: 6, refillPerSec: 1 / 600 },
  attempt: { capacity: 40, refillPerSec: 0.5 },
  read: { capacity: 60, refillPerSec: 2 },
};
