// POST /api/auth/reset-password
//
// Public endpoint, session-less. Completes a password reset:
//
//   Request body: { token: string, newPassword: string }
//   - The token is the SAME plaintext token that was emailed to the
//     user. We hash it (sha-256) and look up by hash alone (without
//     trusting any userId field on the request — that would let an
//     attacker enumerate by userId+hash pairs).
//   - On success we update users.password_hash and invalidate any
//     other outstanding reset tokens for that user.
//
//   Response:
//     - 200 { ok: true } on success
//     - 400 validation_failed / too_large / invalid_json
//     - 200 { ok: false, error: "reset_failed" } on token issues
//         (intentionally generic — does not leak whether the token
//          existed, was expired, or was already used)
//
// SECURITY:
//   - Never returns token / hash / password to the caller.
//   - Rate-limited per IP.
//   - Audit only token_hash PREFIX (12 chars), never full hash.
//   - Body capped at 64 KB via auth body-kind.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/postgres";
import { PasswordResetService } from "@/lib/auth/password-reset-service";
import { PasswordResetRepository } from "@/lib/auth/password-reset-repository";

export const dynamic = "force-dynamic";

const ResetSchema = z.object({
  token: z.string().min(8).max(256),
  newPassword: z.string().min(12).max(256),
});

function ipHashOf(req: Request): string | null {
  const ip = ipOf(req);
  if (!ip || ip === "unknown") return null;
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(ip, "utf-8").digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  // body cap
  const body = await readCappedBody(request, "auth");
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
  const v = ResetSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }

  // Rate limit per IP (5 / 15 min).
  const ip = ipOf(request);
  const rlIp = consume(`reset-pw:ip:${ip}`, 5, 15 * 60 * 1000);
  if (!rlIp.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const db = getDb();
  const repo = new PasswordResetRepository(db);

  // Look up by token_hash (without userId) so the attacker can't
  // pair arbitrary userIds with their own hashes.
  const tokenHash = sha256Hex(v.data.token);
  const lookup = await db.query<{ user_id: string }>(
    "SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1",
    [tokenHash],
  );
  const row = lookup.rows[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 200 });
  }

  // Use the existing service flow to do hash + consume + apply.
  const { hashPassword } = await import("@/lib/auth/password");
  let newHash: string;
  try {
    newHash = hashPassword(v.data.newPassword);
  } catch {
    return NextResponse.json({ ok: false, error: "policy_failed" }, { status: 400 });
  }

  const svc = new PasswordResetService(db, "");
  const outcome = await svc.completeReset({
    userId: row.user_id,
    plaintextToken: v.data.token,
    newPasswordHash: newHash,
    ipHash: ipHashOf(request),
    requestId: request.headers.get("x-request-id") || cryptoRandomRequestId(),
  });
  if (!outcome.ok) {
    // Always map to the same generic string. The exact reason
    // (expired/used/etc.) is NOT returned to the caller.
    return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 200 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

function sha256Hex(s: string): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(s, "utf-8").digest("hex");
}

function cryptoRandomRequestId(): string {
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(8).toString("hex");
}
