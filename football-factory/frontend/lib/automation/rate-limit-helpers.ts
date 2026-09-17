// Football Factory — automation rate-limit helpers.
//
// This module defines the per-route limits and a single helper that
// applies them with a uniform 429 response shape. We intentionally
// reuse the existing `lib/security/rate-limit.ts` in-memory
// token-bucket implementation (no new dependency) and document that
// the durability is PER-INSTANCE because Vercel serverless runs as
// multiple short-lived Node processes.
//
// Trade-offs:
//   - In-instance limits DO mitigate bursty single-source abuse
//     (e.g. a bot retrying wp-publish 1000 times in a tight loop on
//     one warm function instance).
//   - In-instance limits DO NOT stop a sophisticated attacker from
//     spreading load across many function instances or just waiting
//     for the window to expire.
//   - Documented honestly: this is best-effort per-instance only and
//     MUST be replaced with a distributed rate limiter (Redis /
//     Upstash / Vercel KV) before any high-stakes public exposure.
//
// Response shape on rate-limit:
//   HTTP 429
//   Retry-After: <seconds>
//   { ok: false, error: "rate_limited" }

import "server-only";
import { NextResponse } from "next/server";
import {
  consume,
  clientKeyForIp,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

export type AutomationRateLimitConfig = {
  /** e.g. "wp-publish" — used in the bucket key */
  bucket: string;
  /** max requests per window */
  limit: number;
  /** window in milliseconds */
  windowMs: number;
};

export type AutomationRateLimitOutcome =
  | { ok: true; remaining: number; resetMs: number }
  | { ok: false; status: 429; remaining: 0; resetMs: number };

/**
 * Consume one token for the given IP under the given config.
 *
 * Map cleanly to a NextResponse.json with status 429 + Retry-After.
 */
export function consumeAutomationRateLimit(
  request: Request,
  cfg: AutomationRateLimitConfig,
): AutomationRateLimitOutcome {
  const key = `automation:${cfg.bucket}:${clientKeyForIp(request as Request)}`;
  const result: RateLimitResult = consume(key, cfg.limit, cfg.windowMs);
  if (result.ok) {
    return { ok: true, remaining: result.remaining, resetMs: result.reset_ms };
  }
  return {
    ok: false,
    status: 429,
    remaining: 0,
    resetMs: result.reset_ms,
  };
}

/**
 * Convenience wrapper for routes that prefer to return a Response
 * directly.
 */
export function rateLimitedResponse(resetMs: number): Response {
  const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));
  return NextResponse.json(
    { ok: false, error: "rate_limited", retry_after: retryAfter },
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Per-route conservative limits.
// Window: 60 seconds. All values are PER Vercel function INSTANCE.
// ---------------------------------------------------------------------------

export const AUTOMATION_RL = {
  wpPublish: { bucket: "wp-publish", limit: 10, windowMs: 60_000 } as const,
  wpDraft:   { bucket: "wp-draft",   limit: 10, windowMs: 60_000 } as const,
  editorial: { bucket: "editorial",  limit: 30, windowMs: 60_000 } as const,
  aiAssist:  { bucket: "ai-assist",  limit: 30, windowMs: 60_000 } as const,
  factCheck: { bucket: "fact-check", limit: 30, windowMs: 60_000 } as const,
  rightsCheck: { bucket: "rights-check", limit: 30, windowMs: 60_000 } as const,
  seoCheck:  { bucket: "seo-check",  limit: 30, windowMs: 60_000 } as const,
  dedupe:    { bucket: "dedupe",     limit: 60, windowMs: 60_000 } as const,
  log:       { bucket: "log",        limit: 60, windowMs: 60_000 } as const,
  alert:     { bucket: "alert",      limit: 60, windowMs: 60_000 } as const,
  approvalStatus: { bucket: "approval-status", limit: 60, windowMs: 60_000 } as const,
};
