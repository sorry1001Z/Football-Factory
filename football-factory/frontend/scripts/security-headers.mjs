#!/usr/bin/env node
/**
 * Football Factory — security-header probe (R2.1 Wave A).
 *
 * Probes the configured BASE_URL for the security headers required by
 * the readiness contract:
 *   - Content-Security-Policy
 *   - Strict-Transport-Security
 *   - X-Content-Type-Options
 *   - Referrer-Policy
 *   - Permissions-Policy
 *   - frame-ancestors / X-Frame-Options
 *   - Cache-Control
 *   - HTTPS URL policy (scheme only)
 *
 * Uses the helper module at scripts/hardening.mjs. Does NOT touch
 * any other production tool. Does NOT modify deployment or secrets.
 *
 * Usage:
 *   BASE_URL=https://example.com node scripts/security-headers.mjs
 *   node scripts/security-headers.mjs  # defaults to Vercel Production
 *
 * Output:
 *   - JSON to stdout
 *   - Markdown to scripts/security-headers.md (unless MD_OUT is set)
 *
 * Exit:
 *   0 if no FAIL; 1 otherwise.
 */

import {
  checkCacheHeader,
  checkHttpsUrlPolicy,
  checkSecurityHeaders,
  readinessJson,
  readinessMarkdown,
} from "./hardening.mjs";

const BASE_URL = process.env.BASE_URL ?? "https://football-factory-three.vercel.app";
const MD_OUT = process.env.MD_OUT ?? "security-headers.md";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 15000);

async function main() {
  const headersOut = [];
  const checks = [];
  let response;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    response = await fetch(BASE_URL, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "ff-security-probe/1.0" },
    });
    clearTimeout(t);
    const raw = {};
    response.headers.forEach((v, k) => {
      raw[String(k).toLowerCase()] = String(v);
    });
    headersOut.push({ source: "response", headers: raw });
    const sec = checkSecurityHeaders(raw);
    for (const r of sec) checks.push(r);
    const cc = response.headers.get("cache-control");
    if (cc !== null && cc !== undefined) {
      checks.push(checkCacheHeader(cc));
    } else {
      checks.push(checkCacheHeader(""));
    }
  } catch (err) {
    checks.push({
      id: "probe-fetch",
      category: "availability",
      status: "FAIL",
      evidence: { url: BASE_URL, error: String(err && err.message ? err.message : err) },
      recommendation: "Probe could not reach the target",
    });
  }
  // HTTPS URL policy (scheme-only check).
  checks.push(checkHttpsUrlPolicy(BASE_URL));

  const json = readinessJson(checks);
  const md = readinessMarkdown(checks);

  // Add header-source debug info into evidence for traceability.
  json.headersSource = headersOut;
  json.targetUrl = BASE_URL;

  process.stdout.write(JSON.stringify(json, null, 2) + "\n");
  try {
    const fs = await import("node:fs/promises");
    await fs.writeFile(MD_OUT, md + "\n", "utf8");
    process.stderr.write(`wrote: ${MD_OUT}\n`);
  } catch (err) {
    process.stderr.write(`md write failed: ${err && err.message ? err.message : err}\n`);
  }
  const fails = json.counts.FAIL ?? 0;
  process.exit(fails > 0 ? 1 : 0);
}

main();
