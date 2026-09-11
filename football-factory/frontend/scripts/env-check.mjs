#!/usr/bin/env node
/**
 * Football Factory — env-var presence check.
 *
 * Adapted from the external Production Gates Pack (Pack 1).
 *
 * Usage:
 *   npm run smoke:env
 *
 * Behavior:
 *   - Verifies presence of NEXT_PUBLIC_SITE_URL (NOT NEXT_PUBLIC_APP_URL — that
 *     was the pack's original env name; the canonical name in our repo is
 *     NEXT_PUBLIC_SITE_URL).
 *   - Reports lengths, never values.
 *   - Exits 2 if any required env is missing or invalid.
 *   - Exits 0 otherwise.
 *   - Never prints secret values.
 */

const REQUIRED = [
  // Production-Required-Now (per scripts/validate-prod.mjs classification).
  // Here we only assert the canonical public URL exists; the full
  // shape check is in validate-prod.mjs.
  "NEXT_PUBLIC_SITE_URL",
];

const PLACEHOLDER_RE = /(CHANGE_ME|example\.com|replace-with|localhost|127\.0\.0\.1|trycloudflare)/i;

const rows = [];
let fails = 0;

for (const k of REQUIRED) {
  const v = process.env[k];
  if (typeof v !== "string" || v.length === 0) {
    rows.push({ k, status: "MISSING", len: 0 });
    fails++;
    continue;
  }
  if (PLACEHOLDER_RE.test(v)) {
    rows.push({ k, status: "PLACEHOLDER", len: v.length });
    fails++;
    continue;
  }
  if (!/^https?:\/\//.test(v)) {
    rows.push({ k, status: "INVALID_SCHEME", len: v.length });
    fails++;
    continue;
  }
  rows.push({ k, status: "OK", len: v.length });
}

for (const r of rows) {
  console.log(`  ${r.k.padEnd(30)} ${r.status.padEnd(12)} length=${r.len}`);
}
console.log();
if (fails > 0) {
  console.error(`FAIL: ${fails} required env var(s) missing/invalid`);
  process.exit(2);
}
console.log("PASS");
