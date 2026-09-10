// Football Factory — automation auth helper (FIRST SLICE).
//
// Automation routes authenticate via the `x-automation-secret` header.
// The expected secret is read from AUTOMATION_SECRET env var. Constant-
// time comparison.
//
// CSRF check is NOT applied to automation routes — they use shared-
// secret auth, not cookie auth. (CSRF applies to cookie-authenticated
// state changes only.)

import "server-only";
import { timingSafeEqual } from "node:crypto";

export const AUTOMATION_SECRET_HEADER = "x-automation-secret";

const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with)/i;

export type AutomationAuthResult =
  | { ok: true }
  | { ok: false; status: 401; error: "automation_secret_not_configured" | "automation_secret_invalid" };

export function verifyAutomationSecret(request: { headers: { get(name: string): string | null } }): AutomationAuthResult {
  const expected = process.env.AUTOMATION_SECRET;
  if (typeof expected !== "string" || expected.length < 16 || PLACEHOLDER_RE.test(expected)) {
    return { ok: false, status: 401, error: "automation_secret_not_configured" };
  }
  const got = request.headers.get(AUTOMATION_SECRET_HEADER);
  if (!got) return { ok: false, status: 401, error: "automation_secret_invalid" };
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "automation_secret_invalid" };
  }
  return { ok: true };
}

export function authRejectResponse(r: Extract<AutomationAuthResult, { ok: false }>): Response {
  return new Response(
    JSON.stringify({ ok: false, error: r.error }),
    { status: r.status, headers: { "content-type": "application/json" } },
  );
}
