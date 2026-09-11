#!/usr/bin/env node
/**
 * Football Factory — production smoke probe.
 *
 * Adapted from the external Production Gates Pack (Pack 1).
 * Default target: https://football-factory-three.vercel.app
 *
 * Usage:
 *   BASE_URL=https://football-factory-three.vercel.app npm run smoke
 *
 * Behavior:
 *   - Probes every required route via HEAD-then-GET.
 *   - Reports per-route status + duration.
 *   - Exits 0 if all routes return < 500.
 *   - Exits 1 if any route returns >= 500.
 *   - Never prints credentials or Authorization headers.
 */
const base = (process.env.BASE_URL || "https://football-factory-three.vercel.app").replace(/\/$/, "");
const routes = [
  "/",
  "/news/phase-3-test",
  "/sitemap.xml",
  "/robots.txt",
  "/api/health/wordpress?probe=1",
];

let fails = 0;
const rows = [];
for (const route of routes) {
  const url = base + route;
  const t0 = performance.now();
  try {
    const r = await fetch(url, { redirect: "manual" });
    const ms = Math.round(performance.now() - t0);
    const status = r.status;
    rows.push({ route, status, ms });
    console.log(`  ${route.padEnd(36)} HTTP ${status} (${ms}ms)`);
    if (status >= 500) fails++;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    rows.push({ route, status: "ERROR", ms });
    console.log(`  ${route.padEnd(36)} ERROR ${e?.message || e} (${ms}ms)`);
    fails++;
  }
}

console.log();
console.log(`  total: ${rows.length}  fails: ${fails}`);
if (fails > 0) {
  console.error("FAIL: at least one route returned >= 500 or errored");
  process.exit(1);
}
console.log("PASS");
