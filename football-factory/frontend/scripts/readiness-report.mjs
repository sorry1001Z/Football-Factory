#!/usr/bin/env node
/**
 * Football Factory — readiness report helper (R2.1 Wave A).
 *
 * Pure pass-through: takes a JSON array of `{id, category, status,
 * evidence, recommendation}` results on stdin OR via JSON_OUT env
 * and emits both JSON and Markdown readiness reports.
 *
 * This is SPEC_ONLY for the backup/alert/health contracts — we
 * intentionally do NOT import those spec-only functions from the
 * external pack. We only expose the readiness JSON + Markdown
 * formatters.
 *
 * Usage:
 *   echo '[{"id":"x","category":"y","status":"PASS","evidence":{},"recommendation":"r"}]' \
 *     | node scripts/readiness-report.mjs
 *   node scripts/readiness-report.mjs < results.json
 *
 * Output:
 *   JSON to stdout
 *   Markdown to MD_OUT (default: readiness.md)
 *
 * Exit: 0 if no FAIL; 1 otherwise.
 */

import { readinessJson, readinessMarkdown } from "./hardening.mjs";

const MD_OUT = process.env.MD_OUT ?? "readiness.md";

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  let results = [];
  if (raw) {
    try {
      results = JSON.parse(raw);
      if (!Array.isArray(results)) {
        process.stderr.write("stdin must be a JSON array\n");
        process.exit(2);
      }
    } catch (err) {
      process.stderr.write(`json parse failed: ${err && err.message ? err.message : err}\n`);
      process.exit(2);
    }
  }
  const json = readinessJson(results);
  const md = readinessMarkdown(results);
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
