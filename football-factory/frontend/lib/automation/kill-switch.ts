// Football Factory — automation kill switch.
//
// Reads `process.env.AUTOMATION_ENABLED`.
// Fail-closed semantics: if the variable is missing OR not exactly
// "true" (string literal — case-sensitive), the switch is OFF.
//
// Routes call `assertAutomationEnabled()` AFTER
// `verifyAutomationSecret()` succeeds and BEFORE any other work. We
// intentionally do not run the kill switch BEFORE the secret check:
// an unauthenticated attacker would otherwise be able to probe
// whether automation is enabled.
//
// The check order in a route must therefore be:
//   1. verifyAutomationSecret(...)
//   2. assertAutomationEnabled(...)             <— this file
//   3. rate-limit consume(...)
//   4. parse + validate body
//   5. business gates
//   6. mutation
//
// Response on disabled:
//   HTTP 503
//   { ok: false, error: "automation_disabled" }
//
// `AUTOMATION_ENABLED` defaults to DISABLED when missing. Production
// MUST set this to "true" explicitly in the environment to enable any
// mutation-capable automation endpoint. This is intentionally
// fail-closed so a misconfigured deploy (e.g. Vercel env drop, Vercel
// preview deploy) defaults to NO automation.

import "server-only";
import { NextResponse } from "next/server";

export type AutomationEnabledResult =
  | { ok: true }
  | { ok: false; status: 503; error: "automation_disabled" };

/**
 * Returns the canonical state of the kill switch. Pure function —
 * does NOT check the request.
 */
export function isAutomationEnabled(): boolean {
  return process.env.AUTOMATION_ENABLED === "true";
}

/**
 * Returns the route-level guard object. Maps cleanly to
 * `authRejectResponse(result)` style.
 */
export function assertAutomationEnabled(): AutomationEnabledResult {
  if (isAutomationEnabled()) return { ok: true };
  return { ok: false, status: 503, error: "automation_disabled" };
}

/**
 * Convenience helper for routes that already use NextResponse.json.
 */
export function automationDisabledResponse(): Response {
  return NextResponse.json(
    { ok: false, error: "automation_disabled" },
    { status: 503, headers: { "content-type": "application/json" } },
  );
}
