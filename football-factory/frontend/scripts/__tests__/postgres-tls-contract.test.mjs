import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const scriptsDir = join(process.cwd(), "scripts");

test("migration runner enforces verified TLS and does not print DB details", () => {
  const source = readFileSync(join(scriptsDir, "migrate.mjs"), "utf8");
  assert.match(source, /rejectUnauthorized:\s*true/);
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
  assert.doesNotMatch(source, /err\?\.message|redact\(url\)/);
  assert.match(source, /SQLSTATE/);
});

test("migration runner rejects disabled production TLS before DB access", () => {
  const sentinel = "DB-CREDENTIAL-NOT-PRINTED-2b8f";
  const result = spawnSync("node", [join(scriptsDir, "migrate.mjs")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: `postgres://user:${sentinel}@db.example.test/app?sslmode=disable`,
      NODE_ENV: "production",
      PGSSLMODE: "",
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /TLS configuration invalid/);
  assert.equal(`${result.stdout}${result.stderr}`.includes(sentinel), false);
});

test("migration runner rejects disabled TLS for non-loopback targets too", () => {
  const result = spawnSync("node", [join(scriptsDir, "migrate.mjs")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: "postgres://user:password@db.example.test/app?sslmode=disable",
      NODE_ENV: "development",
      PGSSLMODE: "",
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /TLS configuration invalid/);
});
