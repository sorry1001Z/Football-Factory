// POST /api/admin/security/change-password
//
// Authenticated admin/editor endpoint. The user must already be
// signed in (we reuse lib/admin/guard.ts). Body:
//
//   { currentPassword: string, newPassword: string }
//
// Validates:
//   - requireAdminOrEditor()            → 401 / 403 / 503 guard
//   - checkCsrf()                       → 403 csrf_rejected
//   - body cap (1 MB admin kind)
//   - rate limit per user
//   - verify current password against stored hash
//   - canonical hashPassword(newPassword) applied
//
// Returns generic messages. Never returns the stored hash or the
// plaintext password.
//
// SECURITY:
//   - audit_logs row per request, no plaintext / hash / token content
//   - on success, all outstanding password_reset_tokens for this
//     user are invalidated via the same DB transaction (handled by
//     AuthenticatedChangePassword.change())

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume } from "@/lib/security/rate-limit";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { requireAdminOrEditor } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import { AuthenticatedChangePassword } from "@/lib/auth/change-password";

export const dynamic = "force-dynamic";

const Schema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

function ipHashOf(req: Request): string | null {
  const h = req.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!ip) return null;
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(ip, "utf-8").digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const guard = requireAdminOrEditor({ headers: request.headers });
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const body = await readCappedBody(request, "admin");
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  if (!body.raw) return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });
  let parsed: unknown;
  try { parsed = JSON.parse(body.raw); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const v = Schema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  if (v.data.currentPassword === v.data.newPassword) {
    return NextResponse.json({ ok: false, error: "same_password" }, { status: 400 });
  }

  const rl = consume(
    `change-pw:user:${guard.session.userId}`,
    5,
    15 * 60 * 1000,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reset_ms: rl.reset_ms },
      { status: 429 },
    );
  }

  const svc = new AuthenticatedChangePassword(getDb());
  const outcome = await svc.change({
    userId: guard.session.userId,
    currentPassword: v.data.currentPassword,
    newPassword: v.data.newPassword,
    ipHash: ipHashOf(request),
    requestId: request.headers.get("x-request-id") || randomRequestId(),
  });
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

function randomRequestId(): string {
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(8).toString("hex");
}
