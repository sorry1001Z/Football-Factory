// Football Factory — Commercial adapter tests (R2 Wave 2A).
//
// Covers:
//   - getCommercialHomeData: degrades safely when getHomepageNews fails
//   - getCommercialHomeData: never sets Asset from a bare URL
//   - getCommercialHomeData: image.asset is always undefined (data safety)
//   - getCommercialHomeData: 6 league sections populated (no fabrication)
//   - getCommercialNewsListData: page navigation, graceful empty / degraded
//   - getCommercialSearchData: empty/non-empty query returns available=false
//     (live ContentService has no search method — no fabricated results)
//   - explainDegraded: text per source state

import test from "node:test";
import assert from "node:assert/strict";
import {
  getCommercialHomeData,
  getCommercialNewsListData,
  getCommercialSearchData,
  explainDegraded,
} from "../adapter";
import { __setContentClientForTest } from "@/lib/content";
import { WordPressClient } from "@/lib/wordpress/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Reset to default (unconfigured) so this file's tests start clean.
test("reset content client (first test enforces isolation for all subsequent)", () => {
  __setContentClientForTest(null);
});

test("home: degraded when upstream returns 500", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        new Response("boom", { status: 500 })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialHomeData();
  // When upstream 500s, getHomepageNews falls back to mock data and
  // marks the source as degraded. The adapter propagates that marker.
  // Mocks still populate hero/latest/breaking for graceful UX.
  assert.equal(data.source.data, "degraded");
  assert.equal(data.leagueSections.length, 6);
  // The fallback to mocks means hero/latest carry mock data — that's
  // intentional, not a regression.
  assert.ok(data.hero.length > 0, "hero should fall back to mocks");
  assert.ok(data.latest.length > 0, "latest should fall back to mocks");
  __setContentClientForTest(null);
});

test("home: degraded EMPTY_RESPONSE when upstream returns zero posts", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        jsonResponse({ data: { posts: { nodes: [] } } })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialHomeData();
  // The adapter falls back to mockNews for lead/side/latest so the
  // hero/latest are non-empty even with EMPTY_RESPONSE.
  // Source reflects the upstream's degraded state but data layer is the mock.
  assert.equal(data.source.data, "degraded");
  assert.ok(data.hero.length > 0, "hero should fall back to mocks");
  __setContentClientForTest(null);
});

test("home: image.asset is always undefined (no fabricated Asset)", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        jsonResponse({ data: { posts: { nodes: [] } } })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialHomeData();
  for (const item of data.hero) {
    assert.equal(item.image.asset, undefined, "hero asset must be undefined");
  }
  for (const item of data.latest) {
    assert.equal(item.image.asset, undefined, "latest asset must be undefined");
  }
  for (const section of data.leagueSections) {
    for (const item of section.items) {
      assert.equal(item.image.asset, undefined, "league asset must be undefined");
    }
  }
  for (const item of data.trending) {
    assert.equal(item.image.asset, undefined, "trending asset must be undefined");
  }
  for (const item of data.editorsPick) {
    assert.equal(item.image.asset, undefined, "editors asset must be undefined");
  }
  for (const item of data.breaking) {
    assert.equal(item.image.asset, undefined, "breaking asset must be undefined");
  }
  __setContentClientForTest(null);
});

test("home: 6 league sections in canonical order", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        jsonResponse({ data: { posts: { nodes: [] } } })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialHomeData();
  const slugs = data.leagueSections.map((s) => s.slug);
  assert.deepEqual(slugs, [
    "premier-league",
    "champions-league",
    "laliga",
    "bundesliga",
    "serie-a",
    "ligue-1",
  ]);
  __setContentClientForTest(null);
});

test("home: never throws even when content upstream fails", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        new Response("boom", { status: 500 })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialHomeData();
  assert.ok(data);
  assert.equal(data.source.data, "degraded");
  __setContentClientForTest(null);
});

test("news list: page 1 returns up to pageSize items (mock fallback)", async () => {
  __setContentClientForTest(null);
  const data = await getCommercialNewsListData(1, 10);
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 10);
  assert.ok(data.items.length <= 10);
});

test("news list: page 2 returns next slice", async () => {
  __setContentClientForTest(null);
  const p1 = await getCommercialNewsListData(1, 5);
  const p2 = await getCommercialNewsListData(2, 5);
  const p1Slugs = new Set(p1.items.map((i) => i.slug));
  for (const it of p2.items) {
    assert.ok(!p1Slugs.has(it.slug), `page 2 leaked slug ${it.slug}`);
  }
});

test("news list: degraded when upstream returns 500 (with mock fallback)", async () => {
  __setContentClientForTest(
    new WordPressClient({
      endpoint: "https://example.com/graphql",
      fetchImpl: (async () =>
        new Response("boom", { status: 500 })) as unknown as typeof fetch,
    }),
  );
  const data = await getCommercialNewsListData(1, 10);
  // getHomepageNews falls back to mocks on upstream failure. The
  // adapter reports the source as degraded but items come from mocks.
  assert.equal(data.source.data, "degraded");
  assert.ok(data.items.length > 0, "items should fall back to mocks");
  __setContentClientForTest(null);
});

test("search: empty query returns available=false with no items", async () => {
  const data = await getCommercialSearchData("");
  assert.equal(data.available, false);
  assert.equal(data.items.length, 0);
  assert.equal(data.query, "");
});

test("search: any non-empty query returns available=false (no fabricated results)", async () => {
  const data = await getCommercialSearchData("manchester");
  assert.equal(data.available, false);
  assert.equal(data.items.length, 0);
  assert.equal(data.query, "manchester");
});

test("search: query is capped at 200 chars (defence in depth)", async () => {
  const long = "x".repeat(500);
  const data = await getCommercialSearchData(long);
  assert.ok(data.query.length <= 200);
});

test("search: query is trimmed", async () => {
  const data = await getCommercialSearchData("   hello   ");
  assert.equal(data.query, "hello");
});

test("explainDegraded: returns empty string when source is not degraded", () => {
  assert.equal(
    explainDegraded({ origin: "wpgraphql", data: "wpgraphql", degradedReason: null }),
    "",
  );
});

test("explainDegraded: returns text per degradedReason", () => {
  const empty = explainDegraded({
    origin: "degraded",
    data: "degraded",
    degradedReason: "EMPTY_RESPONSE",
  });
  assert.match(empty, /No stories/);

  const unconfigured = explainDegraded({
    origin: "unconfigured",
    data: "unconfigured",
    degradedReason: null,
  });
  assert.match(unconfigured, /not configured/);

  const searchMissing = explainDegraded({
    origin: "degraded",
    data: "degraded",
    degradedReason: "search_not_yet_wired_upstream_search_endpoints_only_placeholder",
  });
  assert.match(searchMissing, /Search/);
});
