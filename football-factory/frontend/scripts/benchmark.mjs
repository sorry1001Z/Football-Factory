#!/usr/bin/env node
/**
 * Football Factory — production benchmark.
 *
 * Adapted from:
 *   - the external Performance Pack (Pack 2) — original
 *   - the external Performance / Observability R2 pack (Round 2) —
 *     JSON + Markdown dual output, route grouping, dependency tag,
 *     cache:'no-store', configurable env-driven thresholds and outputs
 *
 * Refactored to import percentile()/summarize() from scripts/_stats.mjs.
 *
 * Usage:
 *   npm run benchmark
 *
 * Env:
 *   BASE_URL             (default: https://football-factory-three.vercel.app)
 *   ROUNDS               (default: 5)
 *   P95_THRESHOLD_MS     (default: 5000)
 *   JSON_OUT             (default: benchmark.json)
 *   MD_OUT               (default: benchmark.md)
 *
 * Behavior:
 *   - Probes each route `ROUNDS` times. First request is cold; remaining
 *     are warm and feed the percentile summary.
 *   - Routes are tagged with `group` and `dependency` so the report
 *     splits frontend vs upstream calls.
 *   - Writes JSON to JSON_OUT (default benchmark.json).
 *   - Writes Markdown to MD_OUT (default benchmark.md).
 *   - Exits 0 if every route passes median target AND no p95 exceeds
 *     P95_THRESHOLD_MS.
 *   - Exits 1 if any median target is missed.
 *   - Exits 2 if p95 exceeds P95_THRESHOLD_MS for any route.
 *   - Never prints credentials. Body draining uses arrayBuffer(); no
 *     cached connection reuse beyond the runtime's HTTP keepalive.
 */

import fs from "node:fs";
import { summarize, percentile } from "./_stats.mjs";
import {
  checkCacheHeader,
  checkHttpsUrlPolicy,
  checkSecurityHeaders,
  readinessJson,
} from "./hardening.mjs";

const base = (process.env.BASE_URL || "https://football-factory-three.vercel.app").replace(/\/$/, "");
const ROUNDS = Number(process.env.ROUNDS || 5);
const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 5000);
const JSON_OUT = process.env.JSON_OUT || "benchmark.json";
const MD_OUT = process.env.MD_OUT || "benchmark.md";
const SECURITY_OUT = process.env.SECURITY_OUT || "benchmark-security.json";

// route groups: { group: { route: { targetMs, dependency } } }
// Median target semantics match the prior slice (homepage/article <= 1500 ms,
// standings <= 1000 ms, wp health reported only).
const ROUTE_GROUPS = {
  public: {
    "/":                                  { targetMs: 1500, dependency: "frontend" },
    "/news/phase-3-test":                 { targetMs: 1500, dependency: "wordpress" },
  },
  api: {
    "/api/football/standings":            { targetMs: 1000, dependency: "football-api" },
    "/api/health/wordpress?probe=1":      { targetMs: null, dependency: "wordpress" },
  },
};

async function timed(url) {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { cache: "no-store", redirect: "manual" });
    await r.arrayBuffer().catch(() => {});
    return { ms: Math.round(performance.now() - t0), status: r.status, error: null };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), status: 0, error: String(e) };
  }
}

/**
 * Capture response headers on a single fetch (used to feed the
 * R2.1 Wave A hardening checks — security-header probe, cache
 * parser, HTTPS URL scheme check). The probe does NOT influence
 * the existing p50/p95 statistics; it is purely additive.
 */
async function captureHeaders(url) {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": "ff-benchmark-security/1.0" },
    });
    const headers = {};
    r.headers.forEach((v, k) => {
      headers[String(k).toLowerCase()] = String(v);
    });
    await r.arrayBuffer().catch(() => {});
    return { ok: true, headers, status: r.status };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err), headers: {}, status: 0 };
  }
}

const out = {
  at: new Date().toISOString(),
  base,
  rounds: ROUNDS,
  p95_threshold_ms: P95_THRESHOLD_MS,
  groups: {},
};

let medianMiss = 0;
let p95ThresholdMiss = 0;
const consoleRows = [];

for (const [group, routes] of Object.entries(ROUTE_GROUPS)) {
  out.groups[group] = {};
  for (const [route, cfg] of Object.entries(routes)) {
    const url = base + route;
    const samples = [];
    for (let i = 0; i < ROUNDS; i++) {
      const s = await timed(url);
      samples.push({ ms: s.ms, status: s.status, error: s.error });
    }
    const warmMs = samples.slice(1).map((x) => x.ms);
    const stats = warmMs.length ? summarize(warmMs) : { count: 0, p50: null, p95: null, min: null, max: null };
    const cold = samples[0];
    const medianMisses = cfg.targetMs != null && stats.p50 != null && stats.p50 > cfg.targetMs;
    const p95Exceeds = stats.p95 != null && stats.p95 > P95_THRESHOLD_MS;
    if (medianMisses) medianMiss++;
    if (p95Exceeds) p95ThresholdMiss++;
    out.groups[group][route] = {
      cold_ms: cold.ms,
      cold_status: cold.status,
      stats,
      target_ms: cfg.targetMs,
      dependency: cfg.dependency,
      median_misses: medianMisses,
      p95_exceeds_threshold: p95Exceeds,
    };
    const consoleLine = `  [${group}] ${route.padEnd(40)} cold=${cold.ms}ms median=${stats.p50}ms p95=${stats.p95}ms target=${cfg.targetMs ?? "n/a"}ms dep=${cfg.dependency} ${medianMisses ? "MISS-MEDIAN" : ""} ${p95Exceeds ? "MISS-P95" : ""}`;
    consoleRows.push(consoleLine);
    console.log(consoleLine);
  }
}

out.summary = {
  median_misses: medianMiss,
  p95_threshold_misses: p95ThresholdMiss,
};

// R2.1 Wave A — additive security + cache + HTTPS probe. Captured
// once from the homepage cold request. Does NOT influence p50/p95.
try {
  const probe = await captureHeaders(base + "/");
  const secChecks = probe.ok ? checkSecurityHeaders(probe.headers) : [];
  const cacheCheck = probe.ok ? checkCacheHeader(probe.headers["cache-control"] ?? "") : null;
  const httpsCheck = checkHttpsUrlPolicy(base);
  const all = cacheCheck ? [...secChecks, cacheCheck, httpsCheck] : [...secChecks, httpsCheck];
  const rj = readinessJson(all);
  rj.target_url = base;
  rj.probe_status = probe.status;
  fs.writeFileSync(SECURITY_OUT, JSON.stringify(rj, null, 2));
  out.security_probe = {
    output: SECURITY_OUT,
    counts: rj.counts,
    probe_status: probe.status,
  };
} catch (err) {
  out.security_probe = { output: SECURITY_OUT, error: String(err && err.message ? err.message : err) };
}

// JSON output
fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));

// Markdown output
let md = `# Performance Benchmark\n\n- at: ${out.at}\n- base: ${base}\n- rounds: ${ROUNDS}\n- p95_threshold_ms: ${P95_THRESHOLD_MS}\n\n`;
for (const [g, rs] of Object.entries(out.groups)) {
  md += `## ${g}\n\n| route | dependency | cold_ms | median_ms | p95_ms | target_ms | status |\n|---|---|---|---|---|---|---|\n`;
  for (const [r, v] of Object.entries(rs)) {
    md += `| ${r} | ${v.dependency} | ${v.cold_ms} | ${v.stats.p50} | ${v.stats.p95} | ${v.target_ms ?? "n/a"} | ${v.median_misses ? "MISS-MEDIAN" : v.p95_exceeds_threshold ? "MISS-P95" : "OK"} |\n`;
  }
}
md += `\n## summary\n\n- median_misses: ${medianMiss}\n- p95_threshold_misses: ${p95ThresholdMiss}\n`;
fs.writeFileSync(MD_OUT, md);

console.log(`\nWrote ${JSON_OUT} (${fs.statSync(JSON_OUT).size}b) and ${MD_OUT} (${fs.statSync(MD_OUT).size}b).`);

if (p95ThresholdMiss > 0) {
  console.error(`FAIL: ${p95ThresholdMiss} route(s) exceeded p95 threshold ${P95_THRESHOLD_MS}ms`);
  process.exit(2);
}
if (medianMiss > 0) {
  console.error(`FAIL: ${medianMiss} route(s) missed median target`);
  process.exit(1);
}
console.log("PASS");
