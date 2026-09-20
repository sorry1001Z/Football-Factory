// POST /api/auth/forgot-password
//
// Public endpoint, cookie/session/anonymous. Accepts { email } and
// ALWAYS returns the same generic response (no enumeration). Internally:
//   - rate-limits per IP and per normalized email
//   - if account exists and is active, invalidates prior reset tokens,
//     issues a new one (sha-256 hash stored, plaintext only in the
//     outgoing email + dev console log), sends a delivery event to
//     the audit log
//   - if no account / inactive, still returns the generic response and
//     logs a `password_reset_requested` audit event with status
//     unknown_account / inactive_account (no PII)
//
// Never logs the plaintext token, the password, or the full hash.
// Logs only token_hash prefix (12 chars) on success.

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/postgres";
import { PasswordResetService, normalizeEmail } from "@/lib/auth/password-reset-service";

export const dynamic = "force-dynamic";

const ForgotSchema = z.object({
  email: z.string().trim().min(3).max(254),
});

const GENERIC_RESPONSE = {
  ok: true,
  message:
    "หากอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้",
};

function ipHashOf(req: Request): string | null {
  const ip = ipOf(req);
  if (!ip || ip === "unknown") return null;
  // Use Node crypto to sha-256 hash the IP. We do not log the raw IP
  // anywhere in this slice — only this hash.
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(ip, "utf-8").digest("hex");
}

function siteUrlOf(req: Request): string {
  const h = req.headers;
  // Public canonical domain is FF90.online with the www subdomain.
  // The env var NEXT_PUBLIC_SITE_URL is the source-of-truth override;
  // we fall back to the canonical https://www.ff90.online. The reset
  // email body and the reset URL both come from this value, so it
  // is the operator's knob to control the reset link origin.
  return (
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SITE_URL) ||
    h.get("origin") ||
    "https://www.ff90.online"
  );
}

export async function POST(request: Request): Promise<Response> {
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
  const v = ForgotSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }

  // Rate limits — IP first (cheapest), then normalized email.
  const ip = ipOf(request);
  const rlIp = consume(`forgot-pw:ip:${ip}`, 5, 15 * 60 * 1000);
  if (!rlIp.ok) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
  const norm = normalizeEmail(v.data.email);
  if (norm) {
    const rlEmail = consume(`forgot-pw:email:${norm}`, 3, 30 * 60 * 1000);
    if (!rlEmail.ok) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }
  }

  // Service call (always succeeds at the public level).
  try {
    const svc = new PasswordResetService(getDb(), siteUrlOf(request));
    await svc.requestReset({
      email: v.data.email,
      ipHash: ipHashOf(request),
      requestId: request.headers.get("x-request-id") || cryptoRandomRequestId(),
    });
  } catch {
    // Swallow internal failures so the public response stays
    // generic. The audit log path inside the service will already
    // have recorded something for downstream debugging.
  }
  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}

function cryptoRandomRequestId(): string {
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(8).toString("hex");
}
