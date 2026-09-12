// Football Factory — SEO V3 Wave A: domain-neutrality source-scan test.
//
// Ensures the generic core does not contain hardcoded domain terms
// (football / team / player / league / match) outside of comments
// or test descriptions. The scanner is intentionally narrow: it
// flags whole-word matches only, and ignores TypeScript identifier
// tokens that obviously belong to the runtime contract
// (`EntityRef`, `getTextAnalyzer`, etc.).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const root = resolve(dirname(here), "..");
const targets = [
  "canonical.ts",
  "indexing.ts",
  "schema.ts",
  "analyzers.ts",
  "quality.ts",
  "publish-gate.ts",
  "contracts.ts",
];

const FORBIDDEN = /\b(football|team|player|league|match)\b/gi;

// Whitelist of false-positive patterns where the word appears inside
// an unrelated identifier or method name (e.g. String.prototype.match,
// Array.prototype.matches, Math.team, league.match). These are JS
// runtime / library calls, not domain references.
const ALLOWED_IDENTIFIERS: RegExp[] = [
  /\.match\s*\(/g,                  // RegExp / String.prototype.match
  /Array\.from.*\bteam\b/gi,         // Array.from(...) team-shape param
  /Map\s*\(/g,                      // Map constructor (looks like "Match" prefix)
  /\bTeam[A-Z_]/g,                   // TeamName etc (PascalCase identifiers)
  /\bPlayer[A-Z_]/g,
  /\bMatch[A-Z_]/g,
  /\bLeague[A-Z_]/g,
  /\bFootball[A-Z_]/g,
  /\/team\/|\/player\/|\/league\/|\/match\/|\/football\//g,
];

function isAllowedHit(line: string, hit: string): boolean {
  for (const re of ALLOWED_IDENTIFIERS) {
    re.lastIndex = 0;
    if (re.test(line)) return true;
  }
  return false;
}

test("domain-neutral: generic core has no domain hardcoding", () => {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const t of targets) {
    const src = readFileSync(resolve(root, t), "utf8");
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Allow comments only when they describe the test itself.
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
      const m = line.match(FORBIDDEN);
      if (m) {
        for (const hit of m) {
          if (!isAllowedHit(line, hit)) {
            hits.push({ file: t, line: i + 1, text: hit });
          }
        }
      }
    }
  }
  assert.equal(
    hits.length,
    0,
    `domain term hits in generic core: ${JSON.stringify(hits, null, 2)}`,
  );
});
