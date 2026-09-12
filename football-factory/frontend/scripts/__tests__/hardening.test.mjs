// Football Factory — R2.1 Wave A hardening tests.
//
// Imports the helpers from `scripts/hardening.mjs`. Real behavioral
// tests for the cache parser, security-header probes, HTTPS URL
// policy, and readiness report.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCacheControl,
  checkCacheHeader,
  parseHsts,
  checkSecurityHeaders,
  checkHttpsUrlPolicy,
  readinessJson,
  readinessMarkdown,
} from "../hardening.mjs";

test("cache: public", () => {
  const r = parseCacheControl("public");
  assert.equal(r.directives.public, true);
  assert.equal(r.errors.length, 0);
});

test("cache: private", () => {
  const r = parseCacheControl("private");
  assert.equal(r.directives.private, true);
});

test("cache: no-store", () => {
  const r = parseCacheControl("no-store");
  assert.equal(r.directives["no-store"], true);
});

test("cache: no-cache", () => {
  const r = parseCacheControl("no-cache");
  assert.equal(r.directives["no-cache"], true);
});

test("cache: valid max-age", () => {
  const r = parseCacheControl("max-age=3600");
  assert.equal(r.directives["max-age"], 3600);
  assert.equal(r.errors.length, 0);
});

test("cache: valid s-maxage", () => {
  const r = parseCacheControl("s-maxage=600");
  assert.equal(r.directives["s-maxage"], 600);
});

test("cache: malformed max-age (non-numeric) reported safely", () => {
  const r = parseCacheControl("max-age=abc");
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0], "INVALID_MAX_AGE");
});

test("cache: mixed-case header", () => {
  const r = parseCacheControl("Public, Max-Age=60, NO-STORE");
  assert.equal(r.directives.public, true);
  assert.equal(r.directives["max-age"], 60);
  assert.equal(r.directives["no-store"], true);
});

test("cache: checkCacheHeader PASS", () => {
  const r = checkCacheHeader("public, max-age=3600");
  assert.equal(r.status, "PASS");
});

test("cache: checkCacheHeader WARN on missing", () => {
  const r = checkCacheHeader("");
  assert.equal(r.status, "WARN");
});

test("cache: checkCacheHeader WARN on malformed", () => {
  const r = checkCacheHeader("max-age=NaN");
  assert.equal(r.status, "WARN");
});

test("security: complete headers -> mostly PASS", () => {
  const r = checkSecurityHeaders({
    "Content-Security-Policy": "frame-ancestors 'none'",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=()",
  });
  const map = Object.fromEntries(r.map((x) => [x.id, x.status]));
  assert.equal(map["security-csp"], "PASS");
  assert.equal(map["security-hsts"], "PASS");
  assert.equal(map["security-nosniff"], "PASS");
  assert.equal(map["security-referrer"], "PASS");
  assert.equal(map["security-permissions"], "PASS");
});

test("security: missing CSP -> WARN", () => {
  const r = checkSecurityHeaders({});
  const csp = r.find((x) => x.id === "security-csp");
  assert.equal(csp.status, "WARN");
});

test("security: invalid HSTS max-age -> WARN with null maxAge", () => {
  const r = checkSecurityHeaders({
    "Strict-Transport-Security": "max-age=notanumber",
  });
  const hsts = r.find((x) => x.id === "security-hsts");
  assert.equal(hsts.status, "WARN");
  assert.equal(hsts.evidence.maxAge, null);
});

test("security: nosniff PASS", () => {
  const r = checkSecurityHeaders({ "X-Content-Type-Options": "nosniff" });
  const ns = r.find((x) => x.id === "security-nosniff");
  assert.equal(ns.status, "PASS");
});

test("security: invalid X-Content-Type-Options -> WARN", () => {
  const r = checkSecurityHeaders({ "X-Content-Type-Options": "sniff" });
  const ns = r.find((x) => x.id === "security-nosniff");
  assert.equal(ns.status, "WARN");
});

test("security: frame-ancestors PASS without X-Frame-Options", () => {
  const r = checkSecurityHeaders({
    "Content-Security-Policy": "frame-ancestors 'self'",
  });
  const frame = r.find((x) => x.id === "security-frame");
  assert.equal(frame.status, "PASS");
});

test("security: case-insensitive header lookup", () => {
  const r = checkSecurityHeaders({
    "content-security-policy": "frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "strict-transport-security": "max-age=60",
  });
  const csp = r.find((x) => x.id === "security-csp");
  assert.equal(csp.status, "PASS");
  const ns = r.find((x) => x.id === "security-nosniff");
  assert.equal(ns.status, "PASS");
});

test("security: missing/malformed headers never throw", () => {
  // All inputs are optional. The function must always return a row array.
  assert.doesNotThrow(() => checkSecurityHeaders(null));
  assert.doesNotThrow(() => checkSecurityHeaders(undefined));
  assert.doesNotThrow(() => checkSecurityHeaders({}));
});

test("hsts: parseHsts parses includeSubDomains + preload", () => {
  const r = parseHsts("max-age=3600; includeSubDomains; preload");
  assert.equal(r.maxAge, 3600);
  assert.equal(r.includeSubDomains, true);
  assert.equal(r.preload, true);
});

test("hsts: max-age=0 is reported (caller decides WARN/FAIL)", () => {
  const r = parseHsts("max-age=0");
  assert.equal(r.maxAge, 0);
  // checkSecurityHeaders uses hs.maxAge > 0 as PASS gate:
  const sec = checkSecurityHeaders({ "Strict-Transport-Security": "max-age=0" });
  const hsts = sec.find((x) => x.id === "security-hsts");
  assert.equal(hsts.status, "WARN");
});

test("https: PASS on https URL, certificateVerified=false", () => {
  const r = checkHttpsUrlPolicy("https://example.com/");
  assert.equal(r.status, "PASS");
  assert.equal(r.evidence.https ?? r.evidence.protocol, "https:");
  assert.equal(r.evidence.certificateVerified, false);
});

test("https: FAIL on http URL", () => {
  const r = checkHttpsUrlPolicy("http://example.com/");
  assert.equal(r.status, "FAIL");
  assert.equal(r.evidence.certificateVerified, false);
});

test("https: malformed URL returns FAIL (no crash)", () => {
  const r = checkHttpsUrlPolicy("not a url");
  assert.equal(r.status, "FAIL");
  assert.equal(r.evidence.certificateVerified, false);
});

test("readiness: PASS report counts correctly", () => {
  const r = readinessJson([
    { id: "a", category: "x", status: "PASS", evidence: {}, recommendation: "ok" },
    { id: "b", category: "x", status: "PASS", evidence: {}, recommendation: "ok" },
  ]);
  assert.equal(r.counts.PASS, 2);
  assert.equal(r.counts.WARN, 0);
  assert.equal(r.counts.FAIL, 0);
  assert.equal(r.results.length, 2);
});

test("readiness: WARN report counts correctly", () => {
  const r = readinessJson([
    { id: "a", category: "x", status: "WARN", evidence: {}, recommendation: "look" },
  ]);
  assert.equal(r.counts.WARN, 1);
});

test("readiness: FAIL report counts correctly", () => {
  const r = readinessJson([
    { id: "a", category: "x", status: "FAIL", evidence: {}, recommendation: "fix" },
  ]);
  assert.equal(r.counts.FAIL, 1);
});

test("readiness: JSON output shape", () => {
  const r = readinessJson([
    { id: "a", category: "x", status: "PASS", evidence: { k: 1 }, recommendation: "r" },
  ]);
  assert.equal(typeof r.generatedAt, "string");
  assert.ok(r.results.length === 1);
  assert.ok(r.results[0].evidence.k === 1);
});

test("readiness: Markdown output shape", () => {
  const md = readinessMarkdown([
    { id: "a", category: "x", status: "PASS", evidence: {}, recommendation: "ok" },
    { id: "b", category: "x", status: "FAIL", evidence: {}, recommendation: "fix" },
  ]);
  assert.match(md, /# Production Readiness/);
  assert.match(md, /PASS 1/);
  assert.match(md, /FAIL 1/);
  assert.match(md, /\*\*PASS\*\* a/);
  assert.match(md, /\*\*FAIL\*\* b/);
});
