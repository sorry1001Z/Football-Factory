// Football Factory — benchmark output smoke test (R2 Wave 1).
//
// Runs scripts/benchmark.mjs in a fresh temp dir against a local stub
// server and verifies that benchmark.json and benchmark.md are emitted
// with the expected shape.
//
// This test does NOT mutate production or hit any external URL.

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

function startStubServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      resolve({ srv, port });
    });
  });
}

function runNode(args, env, cwd) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { env, cwd });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("benchmark: emits JSON + Markdown with route groups and dependency tags", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ff-bench-"));
  // Stub server: reply 200 to any path with a small body.
  const { srv, port } = await startStubServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  try {
    const r = await runNode(
      ["scripts/benchmark.mjs"],
      {
        ...process.env,
        BASE_URL: `http://127.0.0.1:${port}`,
        ROUNDS: "3",
        P95_THRESHOLD_MS: "5000",
        JSON_OUT: join(dir, "benchmark.json"),
        MD_OUT: join(dir, "benchmark.md"),
      },
      process.cwd(),
    );
    assert.equal(r.code, 0, `benchmark exited non-zero: ${r.stderr}`);
    assert.ok(existsSync(join(dir, "benchmark.json")));
    assert.ok(existsSync(join(dir, "benchmark.md")));
    const json = JSON.parse(readFileSync(join(dir, "benchmark.json"), "utf-8"));
    assert.ok(json.groups);
    assert.ok(json.groups.public);
    assert.ok(json.groups.api);
    for (const [g, rs] of Object.entries(json.groups)) {
      for (const [route, v] of Object.entries(rs)) {
        assert.ok(typeof v.dependency === "string", `dependency missing for ${g}/${route}`);
        assert.ok(v.stats && typeof v.stats.p50 === "number", `p50 missing for ${g}/${route}`);
        assert.ok(v.stats && typeof v.stats.p95 === "number", `p95 missing for ${g}/${route}`);
      }
    }
    const md = readFileSync(join(dir, "benchmark.md"), "utf-8");
    assert.ok(md.includes("# Performance Benchmark"));
    assert.ok(md.includes("| route | dependency | cold_ms |"));
  } finally {
    srv.close();
  }
});

test("benchmark: p95 threshold miss -> exit 2", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ff-bench-p95-"));
  // Stub server with a built-in 200ms delay > threshold (1ms).
  const { srv, port } = await startStubServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    }, 200);
  });
  try {
    const r = await runNode(
      ["scripts/benchmark.mjs"],
      {
        ...process.env,
        BASE_URL: `http://127.0.0.1:${port}`,
        ROUNDS: "5",
        P95_THRESHOLD_MS: "10",  // 10ms threshold; 200ms server will miss
        JSON_OUT: join(dir, "benchmark.json"),
        MD_OUT: join(dir, "benchmark.md"),
      },
      process.cwd(),
    );
    // Cold connection often establishes slowly in fresh processes; the
    // median may also miss the (deliberately low) target. Accept exit 1
    // (median miss) OR exit 2 (p95 miss); both indicate a failed run.
    assert.ok(
      r.code === 1 || r.code === 2,
      `expected exit 1 or 2; got ${r.code}; stderr=${r.stderr}`,
    );
  } finally {
    srv.close();
  }
});

test("benchmark-compare: passes when current <= baseline", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ff-compare-"));
  // Build a baseline file and a current file that's slightly faster.
  const baseline = {
    at: "2026-09-01T00:00:00Z",
    base: "http://x",
    rounds: 5,
    p95_threshold_ms: 5000,
    groups: {
      public: {
        "/": { stats: { count: 4, p50: 200, p95: 1000, min: 180, max: 1100 }, target_ms: 1500, dependency: "frontend" },
      },
    },
  };
  const current = {
    at: "2026-09-11T00:00:00Z",
    base: "http://x",
    rounds: 5,
    p95_threshold_ms: 5000,
    groups: {
      public: {
        "/": { stats: { count: 4, p50: 180, p95: 800, min: 150, max: 900 }, target_ms: 1500, dependency: "frontend" },
      },
    },
  };
  const fs = await import("node:fs");
  const basePath = join(dir, "base.json");
  const curPath = join(dir, "cur.json");
  fs.writeFileSync(basePath, JSON.stringify(baseline));
  fs.writeFileSync(curPath, JSON.stringify(current));

  const r = await runNode(
    ["scripts/benchmark-compare.mjs", basePath, curPath],
    { ...process.env, MAX_REGRESSION_PCT: "20" },
    process.cwd(),
  );
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}; stderr=${r.stderr}`);
});

test("benchmark-compare: regresses when current p95 grows by > max_pct", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ff-compare-regress-"));
  const baseline = {
    groups: {
      public: {
        "/": { stats: { p95: 1000 } },
      },
    },
  };
  const current = {
    groups: {
      public: {
        "/": { stats: { p95: 1500 } },  // 50% growth
      },
    },
  };
  const fs = await import("node:fs");
  const basePath = join(dir, "base.json");
  const curPath = join(dir, "cur.json");
  fs.writeFileSync(basePath, JSON.stringify(baseline));
  fs.writeFileSync(curPath, JSON.stringify(current));

  const r = await runNode(
    ["scripts/benchmark-compare.mjs", basePath, curPath],
    { ...process.env, MAX_REGRESSION_PCT: "20" },
    process.cwd(),
  );
  assert.equal(r.code, 3, `expected exit 3, got ${r.code}; stderr=${r.stderr}`);
});
