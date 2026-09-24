// Tests for scripts/validate-prod.mjs.
//
// We invoke the script as a child process with controlled env. The
// script must:
//   - exit 2 when a REQUIRED_NOW env var is missing or invalid
//   - exit 0 when every REQUIRED_NOW env var is shape-valid
//   - NEVER print a secret value
//   - exit 0 (or non-blocking) when later/optional env vars are absent

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const REPO = process.cwd();
const VALIDATE = join(REPO, "scripts", "validate-prod.mjs");

function runWith(env) {
  return spawnSync("node", [VALIDATE], {
    cwd: REPO,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 15_000,
  });
}

const SAFE_NOW = {
  NEXT_PUBLIC_SITE_URL: "https://football-factory-three.vercel.app",
  WORDPRESS_GRAPHQL_URL: "https://snapshot-zshops-birth-dentists.trycloudflare.com/graphql",
  REVALIDATE_SECRET: "abcdef0123456789",
  DATABASE_URL: "postgres://ff_app:abcdef@db.local/football_factory?sslmode=require",
  AUTH_SECRET: "abcdef0123456789abcdef0123456789",
  WORDPRESS_REST_URL: "https://snapshot-zshops-birth-dentists.trycloudflare.com/wp-json/wp/v2/",
  WORDPRESS_APP_USER: "automation",
  WORDPRESS_APP_PASSWORD: "abcd efgh ijkl mnop qrst uvwx",
  AUTOMATION_SECRET: "abcdef0123456789",
};

test("validate:prod: passes with every REQUIRED_NOW env set and shape-valid", () => {
  const r = runWith(SAFE_NOW);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /PASS/);
});

test("validate:prod: fails when DATABASE_URL is missing", () => {
  const env = { ...SAFE_NOW };
  delete env.DATABASE_URL;
  const r = runWith(env);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /DATABASE_URL/);
});

test("validate:prod: fails when AUTH_SECRET is too short", () => {
  const r = runWith({ ...SAFE_NOW, AUTH_SECRET: "short" });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /AUTH_SECRET/);
});

test("validate:prod: fails when AUTH_SECRET is a placeholder", () => {
  const r = runWith({
    ...SAFE_NOW,
    AUTH_SECRET: "CHANGE_ME_MIN_32_CHARS_xxxxxxxxxxxxxxx",
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /AUTH_SECRET/);
});

test("validate:prod: fails when REVALIDATE_SECRET is missing", () => {
  const env = { ...SAFE_NOW };
  delete env.REVALIDATE_SECRET;
  const r = runWith(env);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /REVALIDATE_SECRET/);
});

test("validate:prod: fails when WORDPRESS_APP_PASSWORD is a placeholder", () => {
  const r = runWith({
    ...SAFE_NOW,
    WORDPRESS_APP_PASSWORD: "CHANGE_ME_min_16_chars_xxxxx",
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /WORDPRESS_APP_PASSWORD/);
});

test("validate:prod: never prints the DATABASE_URL value", () => {
  const sentinel = "SENTINEL-DB-NEVER-PRINT-9b2e";
  const url = `postgres://ff_app:${sentinel}@db.local/football_factory?sslmode=require`;
  const r = runWith({ ...SAFE_NOW, DATABASE_URL: url });
  assert.equal(
    (r.stdout + r.stderr).includes(sentinel),
    false,
    "sentinel leaked into output:\n" + r.stdout + "\n" + r.stderr,
  );
});

test("validate:prod: never prints AUTH_SECRET value", () => {
  const sentinel = "SENTINEL-AUTH-NEVER-PRINT-3a7c";
  const r = runWith({ ...SAFE_NOW, AUTH_SECRET: sentinel });
  assert.equal(
    (r.stdout + r.stderr).includes(sentinel),
    false,
    "AUTH_SECRET leaked:\n" + r.stdout + "\n" + r.stderr,
  );
});

test("validate:prod: never prints WORDPRESS_APP_PASSWORD value", () => {
  const sentinel = "SENTINEL-WP-PWD-NEVER-PRINT-5f8d";
  const r = runWith({
    ...SAFE_NOW,
    WORDPRESS_APP_PASSWORD: sentinel,
  });
  assert.equal(
    (r.stdout + r.stderr).includes(sentinel),
    false,
    "WORDPRESS_APP_PASSWORD leaked:\n" + r.stdout + "\n" + r.stderr,
  );
});

test("validate:prod: never prints REVALIDATE_SECRET value", () => {
  const sentinel = "SENTINEL-REV-NEVER-PRINT-1d4e";
  const r = runWith({ ...SAFE_NOW, REVALIDATE_SECRET: sentinel });
  assert.equal(
    (r.stdout + r.stderr).includes(sentinel),
    false,
    "REVALIDATE_SECRET leaked:\n" + r.stdout + "\n" + r.stderr,
  );
});

test("validate:prod: missing later env vars do NOT block", () => {
  const r = runWith(SAFE_NOW); // no FOOTBALL_API_KEY, no GA4, no Telegram, etc.
  assert.equal(r.status, 0);
  // The summary should still classify later vars as not configured.
  assert.match(r.stdout, /CONFIG_REQUIRED_LATER/);
});

test("validate:prod: classifies each env var with required-now/later/optional", () => {
  const r = runWith(SAFE_NOW);
  assert.match(r.stdout, /REQUIRED_NOW/);
  assert.match(r.stdout, /LATER/);
  assert.match(r.stdout, /OPTIONAL/);
});
