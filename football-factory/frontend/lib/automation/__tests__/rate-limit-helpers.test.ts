// Football Factory — automation rate-limit helpers tests (Slice 5 hardening).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  consumeAutomationRateLimit,
  rateLimitedResponse,
  AUTOMATION_RL,
} from "@/lib/automation/rate-limit-helpers";

function makeReq(): Request {
  // Minimal request shape: consumeAutomationRateLimit only reads headers
  // via ipOf() in clientKeyForIp.
  return new Request("https://example.test/api/automation/wp-publish", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.5" },
  });
}

describe("automation rate-limit helpers", () => {
  it("permits requests below the limit and returns 429 + Retry-After above", () => {
    const req = makeReq();
    const cfg = AUTOMATION_RL.wpPublish; // 10/60s
    let last: { ok: boolean; remaining: number; resetMs: number } | null = null;
    for (let i = 0; i < 12; i++) {
      last = consumeAutomationRateLimit(req, cfg) as never;
    }
    assert.equal(last!.ok, false, "12th request must be limited");
    assert.equal(last!.remaining, 0);
    assert.ok(last!.resetMs > 0);
    // Response shape: 429 + Retry-After + body
    const r = rateLimitedResponse(last!.resetMs);
    assert.equal(r.status, 429);
    const retryHeader = r.headers.get("Retry-After");
    assert.ok(retryHeader && Number(retryHeader) >= 1);
  });
  it("returns ok:true for under-limit requests with decrementing remaining", () => {
    const req = makeReq();
    const cfg = AUTOMATION_RL.factCheck; // 30/60s
    const a = consumeAutomationRateLimit(req, cfg);
    const b = consumeAutomationRateLimit(req, cfg);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.ok(b.remaining < a.remaining);
  });
});
