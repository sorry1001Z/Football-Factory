#!/usr/bin/env node
/**
 * Football Factory — non-destructive security probe.
 *
 * Adapted from the external Production Gates Pack (Pack 1).
 *
 * Usage:
 *   npm run smoke:security
 *
 * Behavior:
 *   - Probes /api/admin/posts without any auth.
 *     Expects 401 unauthenticated (or 503 if AUTH_SECRET is currently
 *     unconfigured; either is a non-destructive safe state).
 *   - Probes /api/automation/deduplicate WITHOUT x-automation-secret.
 *     Expects 401 automation_secret_invalid.
 *   - Probes /api/auth/register with empty body AND a same-origin
 *     Origin header so the CSRF layer accepts and validation kicks in.
 *     Expects 400 validation_failed (NOT 500).
 *
 * No brute-force. No credentials. No destructive mutation.
 */

const base = (process.env.BASE_URL || "https://football-factory-three.vercel.app").replace(/\/$/, "");
let fails = 0;

async function probe(name, url, init = {}, expectedStatuses) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, init);
    const ms = Math.round(performance.now() - t0);
    const ok = expectedStatuses.has(r.status);
    console.log(
      `  ${name.padEnd(40)} HTTP ${r.status} (${ms}ms)  expected=${[...expectedStatuses].join("|")}  ${ok ? "OK" : "FAIL"}`,
    );
    return ok;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    console.log(
      `  ${name.padEnd(40)} ERROR ${e?.message || e} (${ms}ms)  expected=${[...expectedStatuses].join("|")}  FAIL`,
    );
    return false;
  }
}

// 1. /api/admin/posts without cookie -> 401 unauthenticated (or 503 if
//    AUTH_SECRET is currently unconfigured; either is a non-destructive
//    safe state — the route refuses to act on the request).
const r1 = await probe(
  "/api/admin/posts (no cookie)",
  base + "/api/admin/posts",
  { method: "GET" },
  new Set([401, 503]),
);
if (!r1) fails++;

// 2. /api/automation/deduplicate without secret -> 401 automation_secret_invalid
const r2 = await probe(
  "/api/automation/deduplicate (no secret)",
  base + "/api/automation/deduplicate",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotency_key: "smoke-security-probe-123456789012", workflow: "smoke" }),
  },
  new Set([401]),
);
if (!r2) fails++;

// 3. /api/auth/register with empty body AND a same-origin Origin header
//    so the CSRF layer accepts and validation kicks in -> 400 (NOT 500).
const r3 = await probe(
  "/api/auth/register (empty body, same-origin)",
  base + "/api/auth/register",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
    },
    body: JSON.stringify({}),
  },
  new Set([400]),
);
if (!r3) fails++;

console.log();
if (fails > 0) {
  console.error(`FAIL: ${fails} security probe(s) failed`);
  process.exit(1);
}
console.log("PASS");
