#!/usr/bin/env node
/**
 * Football Factory — baseline regression comparison.
 *
 * Adapted from the external Performance / Observability R2 pack
 * (scripts/compare-baseline.mjs) with explicit env-driven config and
 * a clearer exit-code contract:
 *
 *   exit 0  → no regression (or baseline is missing entries, treated
 *              as no comparison; log a notice)
 *   exit 1  → usage error (no baseline or current path, or invalid JSON)
 *   exit 3  → regression detected (p95 grew by more than MAX_REGRESSION_PCT)
 *
 * Usage:
 *   node scripts/benchmark-compare.mjs <baseline.json> <current.json>
 *
 * Env:
 *   MAX_REGRESSION_PCT  (default: 20)
 *   SHOW_PER_ROUTE      (default: 0; set to "1" to print every route delta)
 *
 * Output:
 *   - line per (group, route) with delta %
 *   - final pass/fail summary on stderr
 *
 * Never prints credentials. Pure file reader.
 */

import fs from "node:fs";

function readJsonOrDie(p) {
  if (!fs.existsSync(p)) {
    console.error(`MISSING: ${p}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(`INVALID JSON: ${p}: ${e.message}`);
    process.exit(1);
  }
}

const [, , basePath, currentPath] = process.argv;
if (!basePath || !currentPath) {
  console.error("Usage: benchmark-compare.mjs <baseline.json> <current.json>");
  process.exit(1);
}

const maxRegression = Number(process.env.MAX_REGRESSION_PCT || 20);
const showAll = process.env.SHOW_PER_ROUTE === "1";

const a = readJsonOrDie(basePath);
const b = readJsonOrDie(currentPath);

if (!a.groups || !b.groups) {
  console.error("Both JSON files must contain a `groups` object");
  process.exit(1);
}

let failed = 0;
let compared = 0;
let missing = 0;

for (const g of Object.keys(b.groups)) {
  for (const r of Object.keys(b.groups[g])) {
    const baseStats = a.groups?.[g]?.[r]?.stats;
    const curStats = b.groups[g][r].stats;
    if (!baseStats || baseStats.p95 == null || curStats == null || curStats.p95 == null) {
      missing++;
      if (showAll) console.log(`MISS-BASELINE ${g} ${r}`);
      continue;
    }
    const baseP95 = baseStats.p95;
    const curP95 = curStats.p95;
    const pct = ((curP95 - baseP95) / baseP95) * 100;
    compared++;
    const status = pct > maxRegression ? "REGRESS" : "OK";
    if (status === "REGRESS") failed++;
    if (showAll || status === "REGRESS") {
      const delta = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
      console.log(`${g} ${r}: base ${baseP95}ms -> current ${curP95}ms (${delta}) [${status}]`);
    }
  }
}

console.error(
  `compared=${compared} regressed=${failed} missing=${missing} max_regression_pct=${maxRegression}`,
);

if (failed > 0) {
  console.error(`FAIL: ${failed} route(s) regressed by more than ${maxRegression}%`);
  process.exit(3);
}
console.log("PASS");
