#!/usr/bin/env node
/**
 * Football Factory — production benchmark.
 *
 * Adapted from the external Performance Pack (Pack 2).
 *
 * Usage:
 *   npm run benchmark
 *
 * Behavior:
 *   - Probes real routes only:
 *       /
 *       /news/phase-3-test
 *       /api/football/standings
 *       /api/health/wordpress?probe=1
 *   - For each route: 1 cold request + 4 warm requests.
 *   - Computes:
 *       cold_ms  (first request only)
 *       median   (warm)
 *       p95      (warm; if N >= 5)
 *       min      (warm)
 *       max      (warm)
 *   - Compares median to the published targets:
 *       homepage           <= 1500 ms
 *       article            <= 1500 ms
 *       cached standings   <= 1000 ms
 *       wp health          (no target; reported only)
 *   - Exits 0 if all targets met; 1 if any target missed; 2 on network errors.
 *   - Never prints credentials.
 */
const base = (process.env.BASE_URL || "https://football-factory-three.vercel.app").replace(/\/$/, "");

const routes = [
  { path: "/", targetMs: 1500, label: "homepage" },
  { path: "/news/phase-3-test", targetMs: 1500, label: "article" },
  { path: "/api/football/standings", targetMs: 1000, label: "standings" },
  { path: "/api/health/wordpress?probe=1", targetMs: null, label: "wp_health" },
];

const WARM_COUNT = 4;

function pct(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timed(url) {
  const t0 = performance.now();
  const r = await fetch(url, { redirect: "manual" });
  // Drain body so connection reuse is realistic.
  await r.text().catch(() => {});
  return { ms: Math.round(performance.now() - t0), status: r.status };
}

const summary = [];
let fails = 0;

for (const r of routes) {
  const url = base + r.path;
  console.log(`\n--- ${r.label} (${r.path}) ---`);
  // cold request
  const cold = await timed(url);
  console.log(`  cold   HTTP ${cold.status} (${cold.ms}ms)`);
  // warm requests
  const warm = [];
  for (let i = 0; i < WARM_COUNT; i++) {
    const w = await timed(url);
    warm.push(w);
    console.log(`  warm${i + 1}  HTTP ${w.status} (${w.ms}ms)`);
  }
  const warmMs = warm.map((w) => w.ms);
  const median = pct(warmMs, 50);
  const p95 = warm.length >= 5 ? pct(warmMs, 95) : null;
  const min = Math.min(...warmMs);
  const max = Math.max(...warmMs);
  const meets = r.targetMs == null ? null : median <= r.targetMs;
  if (meets === false) fails++;
  console.log(
    `  summary: median=${median}ms  min=${min}ms  max=${max}ms  p95=${p95 == null ? "n/a" : p95 + "ms"}  target=${r.targetMs == null ? "n/a" : r.targetMs + "ms"}  ${meets == null ? "" : meets ? "MEETS" : "MISSES"}`,
  );
  summary.push({
    label: r.label,
    path: r.path,
    coldMs: cold.ms,
    coldStatus: cold.status,
    medianMs: median,
    minMs: min,
    maxMs: max,
    p95Ms: p95,
    targetMs: r.targetMs,
    meets,
  });
}

console.log("\n========================================");
console.log("  BENCHMARK SUMMARY");
console.log("========================================");
for (const s of summary) {
  const status = s.meets == null ? "n/a" : s.meets ? "MEETS" : "MISSES";
  const target = s.targetMs == null ? "n/a" : s.targetMs + "ms";
  console.log(
    `  ${s.label.padEnd(10)} median=${String(s.medianMs).padStart(5)}ms  target=${target.padStart(7)}  ${status}`,
  );
}
console.log();
if (fails > 0) {
  console.error(`FAIL: ${fails} route(s) missed their latency target`);
  process.exit(1);
}
console.log("PASS");
