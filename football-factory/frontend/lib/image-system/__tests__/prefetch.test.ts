// Football Factory — image-system prefetch tests (R2 Wave 1).
//
// Covers:
//   - MetadataPrefetchJob skips sources that fail canCacheMetadata
//   - canonical dedupe by canonical_source_url
//   - fresh entries are not re-upserted
//   - stale entries are re-upserted
//   - isStale helper
//   - quarantine via JsonAssetIndex (test-only)

import test from "node:test";
import assert from "node:assert/strict";
import { MetadataPrefetchJob, isStale } from "../prefetch";
import type { AssetIndex, SourceAdapter } from "../prefetch";
import { JsonAssetIndex } from "../__test-hooks__/json-asset-index";
import type { Asset, SourcePolicy } from "../types";

const META: SourcePolicy = {
  source_name: "Mock",
  base_url: "https://example.test",
  status: "CHECK_PER_ASSET",
  commercial_use_allowed: true,
  editorial_use_allowed: true,
  attribution_required: false,
  download_allowed: true,
  hotlink_allowed: false,
  api_available: false,
  license_notes: "",
  terms_url: "",
  last_verified_at: "2026-09-11",
  metadata_cache_ttl_hours: 168,
};

const BLOCKED: SourcePolicy = {
  ...META,
  status: "BLOCKED",
  commercial_use_allowed: false,
  editorial_use_allowed: false,
  download_allowed: false,
  metadata_cache_ttl_hours: 0,
};

function makeAsset(id: string, ts: string): Asset {
  return {
    asset_id: id,
    source: "Mock",
    source_page: `https://example.test/p/${id}`,
    image_url: `https://example.test/i/${id}.jpg`,
    license: "CC BY 4.0",
    license_url: `https://example.test/${id}/lic`,
    tags: ["t"],
    last_verified_at: ts,
    canonical_source_url: `https://example.test/c/${id}`,
    state: "ACTIVE",
  };
}

class FakeAdapter implements SourceAdapter {
  constructor(public sourceName: string, public results: Asset[]) {}
  async search(_q: string): Promise<Asset[]> {
    return this.results;
  }
  async refresh(a: Asset): Promise<Asset> {
    return a;
  }
}

test("prefetch: skips sources that fail canCacheMetadata", async () => {
  const index = new JsonAssetIndex();
  const sources = new Map<string, SourceAdapter>();
  const policies = new Map<string, SourcePolicy>();
  sources.set("Good", new FakeAdapter("Good", [makeAsset("a", "2026-09-10")]));
  sources.set("Blocked", new FakeAdapter("Blocked", [makeAsset("b", "2026-09-10")]));
  policies.set("Good", META);
  policies.set("Blocked", BLOCKED);
  const job = new MetadataPrefetchJob(index, sources, policies);
  const { synced, skipped } = await job.run(["any"]);
  assert.equal(synced, 1);
  assert.equal(skipped, 1);
});

test("prefetch: canonical dedupe by canonical_source_url", async () => {
  const stored = new Map<string, Asset>();
  const idx: AssetIndex = {
    async upsert(a) {
      stored.set(a.canonical_source_url, a);
    },
    async get(id) {
      return [...stored.values()].find((x) => x.asset_id === id);
    },
    async find() {
      return [...stored.values()];
    },
    async byCanonical(u) {
      return stored.get(u);
    },
    async quarantine() {},
  };
  const sources = new Map<string, SourceAdapter>();
  const policies = new Map<string, SourcePolicy>();
  const a1 = makeAsset("x", "2026-09-10");
  sources.set("M", new FakeAdapter("M", [a1]));
  policies.set("M", META);
  const job = new MetadataPrefetchJob(idx, sources, policies);
  const r1 = await job.run(["q"]);
  assert.equal(r1.synced, 1);
  // Second run within TTL — should not re-upsert
  const r2 = await job.run(["q"]);
  assert.equal(r2.synced, 0);
});

test("prefetch: stale entries are re-upserted", async () => {
  const stored = new Map<string, Asset>();
  const idx: AssetIndex = {
    async upsert(a) {
      stored.set(a.canonical_source_url, a);
    },
    async get(id) {
      return [...stored.values()].find((x) => x.asset_id === id);
    },
    async find() {
      return [...stored.values()];
    },
    async byCanonical(u) {
      return stored.get(u);
    },
    async quarantine() {},
  };
  const old = makeAsset("y", "2020-01-01T00:00:00Z");
  await idx.upsert(old);
  const sources = new Map<string, SourceAdapter>();
  const policies = new Map<string, SourcePolicy>();
  sources.set("M", new FakeAdapter("M", [makeAsset("y", "2026-09-11")]));
  policies.set("M", META);
  const job = new MetadataPrefetchJob(idx, sources, policies);
  const r = await job.run(["q"]);
  assert.equal(r.synced, 1);
  const updated = await idx.byCanonical(old.canonical_source_url);
  assert.ok(updated);
  assert.ok(updated.last_verified_at > old.last_verified_at);
});

test("isStale: 7-day default TTL", () => {
  const old = makeAsset("z", new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString());
  const fresh = makeAsset("z2", new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString());
  assert.equal(isStale(old), true);
  assert.equal(isStale(fresh), false);
});

test("JsonAssetIndex: quarantine toggles state", async () => {
  const idx = new JsonAssetIndex([makeAsset("q", "2026-09-11")]);
  await idx.quarantine("q", "license");
  const a = await idx.get("q");
  assert.equal(a?.state, "QUARANTINED_LICENSE");
  await idx.quarantine("q", "source");
  const a2 = await idx.get("q");
  assert.equal(a2?.state, "QUARANTINED_SOURCE");
});
