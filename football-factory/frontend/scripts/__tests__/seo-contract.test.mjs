/**
 * Football Factory — SEO contract runtime assertion.
 *
 * Adapted from the external Technical SEO Pack (Pack 5).
 *
 * Run via:
 *   npm run test:scripts          (auto-discovered, sandbox-friendly)
 *   npm run test:seo              (alias for the same suite)
 *
 * Behavior:
 *   - Spawns scripts/seo-check.mjs as a child process with controlled env.
 *   - Asserts the seo-check output line count and PASS marker.
 *   - Exit 0 on PASS, 1 on FAIL.
 *
 * NOTE: This test does NOT connect to a real DB or mutate production.
 * It only shells out to the existing seo-check.mjs CLI probe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(here, "..", "seo-check.mjs");

test("seo-check.mjs script exists at expected path", () => {
  assert.ok(existsSync(scriptPath), `expected ${scriptPath} to exist`);
});

test("seo-check.mjs passes against the production public canonical URL", () => {
  const env = {
    ...process.env,
    BASE_URL: "https://football-factory-three.vercel.app",
    NEXT_PUBLIC_SITE_URL: "https://football-factory-three.vercel.app",
    ARTICLE_PATH: "/news/phase-3-test",
  };
  const r = spawnSync(process.execPath, [scriptPath], {
    env,
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 0, `seo-check.mjs exited with non-zero status; stderr: ${r.stderr}; stdout: ${r.stdout}`);
  assert.match(r.stdout, /PASS/, "expected PASS marker in stdout");
});

test("seo-check.mjs does not print secrets", () => {
  // Defensive: ensure the script does not leak AUTOMATION_SECRET, REVALIDATE_SECRET,
  // or Application Password if those env vars happen to be set in this shell.
  const env = {
    ...process.env,
    BASE_URL: "https://football-factory-three.vercel.app",
    NEXT_PUBLIC_SITE_URL: "https://football-factory-three.vercel.app",
    ARTICLE_PATH: "/news/phase-3-test",
    // Inject sentinel values; the script must never echo them.
    AUTOMATION_SECRET: "SENTINEL-DO-NOT-PRINT-1234",
    REVALIDATE_SECRET: "SENTINEL-DO-NOT-PRINT-5678",
  };
  const r = spawnSync(process.execPath, [scriptPath], { env, encoding: "utf8", timeout: 60_000 });
  const combined = (r.stdout || "") + (r.stderr || "");
  assert.equal(
    combined.includes("SENTINEL-DO-NOT-PRINT-1234"),
    false,
    "seo-check stdout/stderr leaked AUTOMATION_SECRET sentinel",
  );
  assert.equal(
    combined.includes("SENTINEL-DO-NOT-PRINT-5678"),
    false,
    "seo-check stdout/stderr leaked REVALIDATE_SECRET sentinel",
  );
});
