// Football Factory — shared runner for admin-session pipeline routes.
//
// Goal: reuse the same auth/CSRF/rate-limit/audit scaffolding across
// the new admin pipeline endpoints (deduplicate, create, ai-assist,
// fact-check, rights-check, seo-check, wp-draft) so each route file
// stays thin and the behavior is uniform.
//
// This module does NOT touch /api/automation/* and does NOT bypass
// any production gate. It is admin-session authenticated only.

import "server-only";
import { NextResponse } from "next/server";
import {
  requireAdminOrEditor,
  guardResponse,
  type GuardResult,
} from "@/lib/admin/guard";
import {
  checkCsrf,
  csrfRejectResponse,
  type CsrfCheckResult,
} from "@/lib/security/csrf";
import { readCappedBody } from "@/lib/security/body-cap";
import {
  consume,
  clientKeyForIp,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

export type PipelineSession = {
  userId: string;
  role: "admin" | "editor";
};

export type PipelineStepResult<T> =
  | { ok: true; status: 200 | 201; body: T }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 502 | 503;
      error: string;
      details?: Record<string, unknown>;
    };

/**
 * Common scaffolding for admin pipeline POST routes.
 *
 * Performs, in order:
 *   1. CSRF check (cookie-auth routes are subject to CSRF; automation
 *      secret routes are exempt — irrelevant here).
 *   2. Admin/editor session guard.
 *   3. Per-IP rate limit (separate bucket per route action so different
 *      stages don't compete).
 *   4. Body parse + size cap (matches existing admin 1MB pattern).
 *   5. Caller-supplied zod validation.
 *   6. Caller's business logic.
 */
export async function runPipelineStep<S extends Record<string, unknown>>(
  request: Request,
  params: {
    bucket: string;
    limit: number;
    windowMs: number;
    schema: { safeParse(x: unknown): { success: true; data: S } | { success: false } };
  },
  runner: (input: {
    body: S;
    session: PipelineSession;
    request: Request;
  }) => Promise<PipelineStepResult<unknown>>,
): Promise<PipelineStepResult<unknown>> {
  // 1) CSRF
  const csrf: CsrfCheckResult = checkCsrf(request);
  if (!csrf.ok) return csrfToResult(csrf);

  // 2) Auth
  const g: GuardResult = requireAdminOrEditor(request);
  const gResp = guardResponse(g);
  if (gResp !== null) {
    const status = g.ok ? 200 : g.status;
    return {
      ok: false,
      status: status as 401 | 403 | 503,
      error: g.ok ? "forbidden" : (g as { error: string }).error,
    };
  }
  if (!g.ok) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  const session: PipelineSession = {
    userId: g.session.userId,
    role: g.session.role === "admin" ? "admin" : "editor",
  };

  // 3) Rate limit
  const rl: RateLimitResult = consume(
    `admin_pipeline:${params.bucket}:${clientKeyForIp(request as Request)}`,
    params.limit,
    params.windowMs,
  );
  if (!rl.ok) {
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      details: { reset_ms: rl.reset_ms },
    };
  }

  // 4) Body
  const body = await readCappedBody(request, "admin");
  if (!body.ok) {
    return {
      ok: false,
      status: body.reason === "too_large" ? 413 : 400,
      error: body.reason === "too_large" ? "body_too_large" : "body_invalid",
    };
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }

  // 5) Validation
  const v = params.schema.safeParse(parsed);
  if (!v.success) {
    return { ok: false, status: 400, error: "validation_failed" };
  }

  // 6) Business logic
  return await runner({ body: v.data, session, request });
}

function csrfToResult(
  r: Extract<CsrfCheckResult, { ok: false }>,
): PipelineStepResult<never> {
  // We do not need to call csrfRejectResponse — we just need a
  // discriminated result. The response shape that route handlers
  // surface will be { ok: false, error: "csrf_rejected", reason }.
  return {
    ok: false,
    status: 403,
    error: "csrf_rejected",
    details: { reason: r.reason },
  };
}

/**
 * Convert a discriminated result to a NextResponse. Routes use this
 * to surface the runner output.
 */
export function resultToResponse(r: PipelineStepResult<unknown>): Response {
  if (r.ok) {
    return NextResponse.json(r.body as object, { status: r.status });
  }
  return NextResponse.json(
    { ok: false, error: r.error, ...(r.details ?? {}) },
    { status: r.status },
  );
}
