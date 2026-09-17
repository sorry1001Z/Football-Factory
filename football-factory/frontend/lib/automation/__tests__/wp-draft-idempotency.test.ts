// Football Factory — wp-draft idempotency tests (Slice 5 hardening).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideWpDraft } from "@/lib/automation/wp-draft-idempotency";

describe("decideWpDraft", () => {
  it("reuses prior wp_post_id when the run has a valid integer post id", () => {
    const d = decideWpDraft(
      { wp_post_id: 42 },
      null,
      undefined,
    );
    assert.equal(d.ok, true);
    if (d.ok && d.reuse) {
      assert.equal(d.wp_post_id, 42);
      assert.equal(d.reason, "run_output_wp_post_id_reused");
    } else { assert.fail("expected reuse"); }
  });

  it("rejects runs whose stored wp_post_id is malformed", () => {
    const d = decideWpDraft({ wp_post_id: "string" }, null, undefined);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.error, "run_wp_id_invalid");
  });

  it("rejects linkage mismatch when run has editorial_id but caller passes different one", () => {
    const d = decideWpDraft(
      { wp_post_id: 42 },
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    );
    assert.equal(d.ok, false);
    if (!d.ok) {
      assert.equal(d.error, "linkage_conflict");
      assert.equal(
        (d.details as { run_editorial_item_id: string | null }).run_editorial_item_id,
        "11111111-1111-1111-1111-111111111111",
      );
    }
  });

  it("proceeds to create when no prior draft and linkage is consistent", () => {
    const d = decideWpDraft(null, null, undefined);
    assert.equal(d.ok, true);
    if (d.ok) {
      assert.equal(d.reuse, false);
      assert.equal(d.reason, "no_prior_draft");
    }
  });

  it("rejects when run has editorial_item_id and request omits one", () => {
    const d = decideWpDraft(null, "11111111-1111-1111-1111-111111111111", undefined);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.error, "linkage_conflict");
  });
});
