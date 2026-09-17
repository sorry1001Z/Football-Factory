// Football Factory — kill-switch tests (FIRST SLICE / Slice 5 hardening).
//
// Cover:
//   - missing AUTOMATION_ENABLED  => fail-closed (off)
//   - AUTOMATION_ENABLED='false'  => fail-closed
//   - AUTOMATION_ENABLED='1'      => fail-closed (must be exact "true")
//   - AUTOMATION_ENABLED='true'   => enabled

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertAutomationEnabled,
  isAutomationEnabled,
} from "@/lib/automation/kill-switch";

describe("automation kill-switch", () => {
  it("returns ok:false when AUTOMATION_ENABLED is missing", () => {
    delete process.env.AUTOMATION_ENABLED;
    assert.equal(isAutomationEnabled(), false);
    assert.deepEqual(assertAutomationEnabled(), {
      ok: false,
      status: 503,
      error: "automation_disabled",
    });
  });
  it("returns ok:false when AUTOMATION_ENABLED is the string 'false'", () => {
    process.env.AUTOMATION_ENABLED = "false";
    assert.equal(isAutomationEnabled(), false);
    assert.equal(assertAutomationEnabled().ok, false);
  });
  it("returns ok:false for the string '1' (must be exact 'true')", () => {
    process.env.AUTOMATION_ENABLED = "1";
    assert.equal(isAutomationEnabled(), false);
  });
  it("returns ok:false for the string 'TRUE' (case-sensitive)", () => {
    process.env.AUTOMATION_ENABLED = "TRUE";
    assert.equal(isAutomationEnabled(), false);
  });
  it("returns ok:true only for the exact string 'true'", () => {
    process.env.AUTOMATION_ENABLED = "true";
    assert.equal(isAutomationEnabled(), true);
    assert.deepEqual(assertAutomationEnabled(), { ok: true });
  });
});
