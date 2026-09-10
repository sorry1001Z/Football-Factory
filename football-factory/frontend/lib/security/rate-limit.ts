// Football Factory — rate limiter (FIRST SLICE).
//
// In-memory token-bucket-ish sliding window. Suitable for a single
// Node process (Vercel function instance). NOT distributed.
//
// Use the same globalThis-keyed singleton pattern as the WordPress
// client so the limiter state survives across hot reloads.
//
// Limits enforced in this slice:
//   - login:  5 / 60s / IP
//   - register: 3 / 3600s / IP
//   - admin mutation: 60 / 60s / (user_id OR IP)
//
// For distributed production use (multi-instance Vercel), a Redis /
// KV-backed limiter is required. Documented in the audit.

import "server-only";

type Bucket = { ts: number[] };

declare global {
  // eslint-disable-next-line no-var
  var __FF_RATE_LIMITER__: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__FF_RATE_LIMITER__) {
    globalThis.__FF_RATE_LIMITER__ = new Map();
  }
  return globalThis.__FF_RATE_LIMITER__;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  reset_ms: number;
};

export function consume(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const m = buckets();
  let bucket = m.get(key);
  if (!bucket) {
    bucket = { ts: [] };
    m.set(key, bucket);
  }
  bucket.ts = bucket.ts.filter((t) => t > cutoff);
  if (bucket.ts.length >= limit) {
    const oldest = bucket.ts[0];
    return {
      ok: false,
      remaining: 0,
      reset_ms: Math.max(0, oldest + windowMs - now),
    };
  }
  bucket.ts.push(now);
  return {
    ok: true,
    remaining: limit - bucket.ts.length,
    reset_ms: windowMs,
  };
}

/** IP from common headers. Falls back to "unknown". */
export function ipOf(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function clientKeyForUser(request: Request, userId?: string): string {
  return `u:${userId ?? ipOf(request)}`;
}

export function clientKeyForIp(request: Request): string {
  return `ip:${ipOf(request)}`;
}
