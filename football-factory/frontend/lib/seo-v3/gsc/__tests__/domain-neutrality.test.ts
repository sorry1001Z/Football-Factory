// Football Factory — SEO V3 GSC domain-neutrality + network scan (Wave D).

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const here = fileURLToPath(import.meta.url);
const root = resolve(dirname(here), "..");

const targets = [
  "types.ts",
  "provider.ts",
  "fixture-provider.ts",
  "classifier.ts",
  "aggregates.ts",
  "index.ts",
];

const FORBIDDEN_DOMAIN = /\b(football|team|player|league|match)\b/gi;

// Comment / string tolerance patterns (similar to Wave A/B/C).
const ALLOWED_IDENTIFIERS: RegExp[] = [
  /\.match\s*\(/g,
  /Array\.from.*\bteam\b/gi,
  /\bTeam[A-Z_]/g,
  /\bMatch[A-Z_]/g,
  /\bLeague[A-Z_]/g,
  /\bPlayer[A-Z_]/g,
  /\bFootball[A-Z_]/g,
  /\/team\/|\/player\/|\/league\/|\/match\/|\/football\//g,
];

function stripStringLiterals(line: string): string {
  return line
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => " ".repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => " ".repeat(m.length))
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => " ".repeat(m.length));
}

function isCommentLine(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("//") ||
    t.startsWith("*") ||
    t.startsWith("/*") ||
    t.startsWith("*/") ||
    (t.startsWith("/**") && t.endsWith("*/"))
  );
}

function isAllowedHit(line: string): boolean {
  for (const re of ALLOWED_IDENTIFIERS) {
    re.lastIndex = 0;
    if (re.test(line)) return true;
  }
  return false;
}

const NETWORK_BAD = [
  "fetch(",
  "axios",
  "googleapis",
  "googleapis.com",
  "oauth",
  "client_secret",
  "refresh_token",
  "searchconsole.googleapis",
  "googleapis.com/auth/webmasters",
];

test("gsc: domain-neutral", () => {
  const hits: Array<{ file: string; line: number; text: string }> = [];
  for (const t of targets) {
    const src = readFileSync(resolve(root, t), "utf-8");
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (isCommentLine(lines[i])) continue;
      const code = stripStringLiterals(lines[i]);
      const m = code.match(FORBIDDEN_DOMAIN);
      if (m) {
        for (const hit of m) {
          if (!isAllowedHit(lines[i])) {
            hits.push({ file: t, line: i + 1, text: hit });
          }
        }
      }
    }
  }
  assert.equal(hits.length, 0, `domain term hits in gsc core: ${JSON.stringify(hits)}`);
});

test("gsc: zero active network / credential paths in production source", () => {
  const hits: Array<{ file: string; line: number; token: string }> = [];
  for (const t of targets) {
    const src = readFileSync(resolve(root, t), "utf-8");
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (isCommentLine(lines[i])) continue;
      const code = stripStringLiterals(lines[i]);
      for (const bad of NETWORK_BAD) {
        if (code.includes(bad)) {
          hits.push({ file: t, line: i + 1, token: bad });
        }
      }
    }
  }
  assert.equal(hits.length, 0, `network/credential hits in gsc core: ${JSON.stringify(hits)}`);
});
