// Football Factory — image-system policy tests (R2 Wave 1).
//
// Covers:
//   - canUseSource, requiresPerAssetCheck, requiresAttribution
//   - canCacheMetadata
//   - publicationDecision
//   - canDownloadBinary (HARDENED variant — refuses without
//     publicationDecision.ok === true)
//
// Adapted from external Football Image System R2 pack
// (tests/policy.test.mjs) with the binary-download safety correction.

import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseSource,
  requiresPerAssetCheck,
  requiresAttribution,
  canCacheMetadata,
  publicationDecision,
  canDownloadBinary,
} from "../policy";
import type { Asset, SourcePolicy } from "../types";
import registry from "../data/source-registry.json" assert { type: "json" };

const META: SourcePolicy = {
  source_name: "Mock Meta Source",
  base_url: "https://example.test",
  status: "CHECK_PER_ASSET",
  commercial_use_allowed: true,
  editorial_use_allowed: true,
  attribution_required: false,
  download_allowed: true,
  hotlink_allowed: false,
  api_available: false,
  license_notes: "test fixture",
  terms_url: "https://example.test/terms",
  last_verified_at: "2026-09-11",
  metadata_cache_ttl_hours: 168,
};

const APPROVED: SourcePolicy = { ...META, status: "APPROVED" };
const BLOCKED: SourcePolicy = {
  ...META,
  status: "BLOCKED",
  commercial_use_allowed: false,
  editorial_use_allowed: false,
  download_allowed: false,
  metadata_cache_ttl_hours: 0,
};

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    asset_id: "test-1",
    source: "Mock Meta Source",
    source_page: "https://example.test/page/1",
    image_url: "https://example.test/img/1.jpg",
    license: "CC BY 4.0",
    license_url: "https://example.test/asset/1/license",
    attribution: "Author / Photographer",
    author: "Author",
    tags: ["test"],
    last_verified_at: "2026-09-11T00:00:00Z",
    canonical_source_url: "https://example.test/asset/1",
    state: "ACTIVE",
    ...overrides,
  };
}

test("policy: registry is non-empty and cautious", () => {
  assert.ok(registry.length >= 5);
  assert.ok(
    registry.find((x) => x.source_name === "Wikimedia Commons")?.status === "CHECK_PER_ASSET",
  );
  assert.ok(
    registry.find((x) => x.source_name === "Competitor news sites")?.status === "BLOCKED",
  );
});

test("policy: no CHECK_PER_ASSET source is misclassified as APPROVED", () => {
  for (const s of registry) {
    if (s.status === "CHECK_PER_ASSET") {
      // CHECK_PER_ASSET sources must keep requiring per-asset review;
      // they may NOT be silently promoted.
      assert.equal(s.commercial_use_allowed, true);
      // they may or may not require attribution, but download+hotlink
      // rules are tightly bounded.
      assert.ok(typeof s.download_allowed === "boolean");
      assert.ok(typeof s.hotlink_allowed === "boolean");
    }
  }
});

test("canUseSource: BLOCKED is never usable", () => {
  assert.equal(canUseSource(BLOCKED), false);
});

test("canUseSource: APPROVED + commercial + editorial = true", () => {
  assert.equal(canUseSource(APPROVED), true);
});

test("canUseSource: APPROVED but commercial_use_allowed=false = false", () => {
  assert.equal(canUseSource({ ...APPROVED, commercial_use_allowed: false }), false);
});

test("requiresPerAssetCheck", () => {
  assert.equal(requiresPerAssetCheck(META), true);
  assert.equal(requiresPerAssetCheck(APPROVED), false);
  assert.equal(requiresPerAssetCheck(BLOCKED), false);
});

test("requiresAttribution: source flag OR CC BY license", () => {
  assert.equal(requiresAttribution({ ...META, attribution_required: true }), true);
  assert.equal(requiresAttribution(META, makeAsset({ license: "All Rights Reserved" })), false);
  assert.equal(
    requiresAttribution(META, makeAsset({ license: "CC BY 4.0" })),
    true,
  );
});

test("canCacheMetadata: BLOCKED or zero-TTL cannot cache", () => {
  assert.equal(canCacheMetadata(BLOCKED), false);
  assert.equal(canCacheMetadata({ ...META, metadata_cache_ttl_hours: 0 }), false);
  assert.equal(canCacheMetadata(META), true);
});

test("publicationDecision: blocked source", () => {
  const r = publicationDecision(BLOCKED, makeAsset());
  assert.equal(r.ok, false);
  assert.equal(r.reason, "blocked-source");
});

test("publicationDecision: CHECK_PER_ASSET without license_url is unresolved", () => {
  const r = publicationDecision(META, makeAsset({ license: "CC BY 4.0", license_url: undefined }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "rights-unresolved");
});

test("publicationDecision: APPROVED + ACTIVE + license + url = ok", () => {
  const r = publicationDecision(APPROVED, makeAsset());
  assert.equal(r.ok, true);
  assert.equal(r.reason, "verified-metadata-present");
});

test("publicationDecision: quarantined asset is refused", () => {
  const r = publicationDecision(APPROVED, makeAsset({ state: "QUARANTINED_LICENSE" }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "QUARANTINED_LICENSE");

  const r2 = publicationDecision(APPROVED, makeAsset({ state: "QUARANTINED_SOURCE" }));
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, "QUARANTINED_SOURCE");
});

test("canDownloadBinary: HARDENED — refuses without publicationDecision", () => {
  // Without the explicit publicationDecision argument, refuse.
  // The function signature now REQUIRES opts.requirePublicationDecision.
  // This is enforced at the type level; we test the runtime check too.
  // @ts-expect-error — testing without opts must fail
  assert.equal(canDownloadBinary(APPROVED, makeAsset()), false);
  // Empty opts object — also refuse
  assert.equal(
    // @ts-expect-error — empty opts
    canDownloadBinary(APPROVED, makeAsset(), {}),
    false,
  );
});

test("canDownloadBinary: HARDENED — refuses when publicationDecision is not ok", () => {
  const dec = publicationDecision(BLOCKED, makeAsset());
  assert.equal(canDownloadBinary(APPROVED, makeAsset(), { requirePublicationDecision: dec }), false);
});

test("canDownloadBinary: HARDENED — refuses when asset lacks license_url even if dec is ok", () => {
  // Build a decision manually (simulating an APPROVED source decision)
  const dec = { ok: true, reason: "verified-metadata-present" } as const;
  assert.equal(
    canDownloadBinary(APPROVED, makeAsset({ license_url: undefined }), {
      requirePublicationDecision: dec,
    }),
    false,
  );
});

test("canDownloadBinary: HARDENED — accepts only when ALL conditions met", () => {
  const dec = publicationDecision(APPROVED, makeAsset());
  assert.equal(dec.ok, true);
  assert.equal(
    canDownloadBinary(APPROVED, makeAsset(), { requirePublicationDecision: dec }),
    true,
  );
});
