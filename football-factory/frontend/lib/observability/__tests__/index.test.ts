// Football Factory — observability tests (R2 Wave 1).
//
// Covers:
//   - aggregate() with mixed health records
//   - classifyHttp() for common status codes

import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, classifyHttp, type Health } from "../index";

test("aggregate: all healthy", () => {
  const xs: Health[] = [
    { service: "wp", ok: true, latencyMs: 50, dependency: "wordpress" },
    { service: "fb", ok: true, latencyMs: 80, dependency: "football-api" },
  ];
  const r = aggregate(xs);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, false);
  assert.equal(r.services.length, 2);
});

test("aggregate: one degraded -> degraded=true, ok=false", () => {
  const xs: Health[] = [
    { service: "wp", ok: true, latencyMs: 50, dependency: "wordpress" },
    {
      service: "fb",
      ok: false,
      latencyMs: 2000,
      dependency: "football-api",
      errorClass: "TIMEOUT",
    },
  ];
  const r = aggregate(xs);
  assert.equal(r.ok, false);
  assert.equal(r.degraded, true);
});

test("classifyHttp: 401/403 -> AUTH", () => {
  assert.equal(classifyHttp(401), "AUTH");
  assert.equal(classifyHttp(403), "AUTH");
});

test("classifyHttp: 408/504 -> TIMEOUT", () => {
  assert.equal(classifyHttp(408), "TIMEOUT");
  assert.equal(classifyHttp(504), "TIMEOUT");
});

test("classifyHttp: 429 -> RATE_LIMIT", () => {
  assert.equal(classifyHttp(429), "RATE_LIMIT");
});

test("classifyHttp: 4xx -> VALIDATION", () => {
  assert.equal(classifyHttp(400), "VALIDATION");
  assert.equal(classifyHttp(422), "VALIDATION");
});

test("classifyHttp: 5xx -> UPSTREAM", () => {
  assert.equal(classifyHttp(500), "UPSTREAM");
  assert.equal(classifyHttp(502), "UPSTREAM");
  assert.equal(classifyHttp(503), "UPSTREAM");
});

test("classifyHttp: status 0 + network=true -> NETWORK", () => {
  assert.equal(classifyHttp(0, true), "NETWORK");
});

test("classifyHttp: status 0 + network=false -> TIMEOUT", () => {
  assert.equal(classifyHttp(0, false), "TIMEOUT");
});
