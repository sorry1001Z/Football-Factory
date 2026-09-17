// Football Factory — wp-publish audit envelope tests (Slice 5 hardening).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recordWpPublishAttempt,
  recordWpPublishResult,
} from "@/lib/automation/wp-publish-audit";

class FakeRepo {
  inserted: number[] = [];
  fail = false;
  async insert(_entry: unknown): Promise<{ id: number }> {
    if (this.fail) throw new Error("simulated_insert_failure");
    const id = this.inserted.length + 1;
    this.inserted.push(id);
    return { id };
  }
}

describe("recordWpPublishAttempt", () => {
  it("returns ok:true when the audit insert succeeds", async () => {
    const r = new FakeRepo();
    const out = await recordWpPublishAttempt(r, {
      editorial_item_id: null, wp_post_id: null, request_wp_post_id: 1,
      request_id: null, ip_hash: null,
    });
    assert.equal(out.ok, true);
    assert.equal(r.inserted.length, 1);
  });
  it("returns ok:false when the audit insert throws (does NOT rethrow)", async () => {
    const r = new FakeRepo();
    r.fail = true;
    const out = await recordWpPublishAttempt(r, {
      editorial_item_id: null, wp_post_id: null, request_wp_post_id: 1,
      request_id: null, ip_hash: null,
    });
    assert.equal(out.ok, false);
  });
});

describe("recordWpPublishResult", () => {
  it("records success actions", async () => {
    const r = new FakeRepo();
    const out = await recordWpPublishResult(r, {
      editorial_item_id: null, wp_post_id: 7, request_wp_post_id: 7,
      request_id: null, ip_hash: null,
    }, true);
    assert.equal(out.ok, true);
  });
  it("records failure actions", async () => {
    const r = new FakeRepo();
    const out = await recordWpPublishResult(r, {
      editorial_item_id: null, wp_post_id: 7, request_wp_post_id: 7,
      request_id: null, ip_hash: null, failure_kind: "timeout", failure_http: null,
    }, false);
    assert.equal(out.ok, true);
  });
  it("returns ok:false without throwing when the insert fails", async () => {
    const r = new FakeRepo();
    r.fail = true;
    const out = await recordWpPublishResult(r, {
      editorial_item_id: null, wp_post_id: 7, request_wp_post_id: 7,
      request_id: null, ip_hash: null,
    }, true);
    assert.equal(out.ok, false);
  });
});
