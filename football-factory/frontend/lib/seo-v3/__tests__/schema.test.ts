// Football Factory — SEO V3 schema validator tests (Wave A).

import { test } from "node:test";
import assert from "node:assert/strict";
import { graph, validateGraph } from "../schema";

test("schema: empty graph invalid", () => {
  const r = validateGraph(graph([]));
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === "EMPTY_GRAPH"));
});

test("schema: missing @type flagged", () => {
  const r = validateGraph(graph([{ "@id": "x" }]));
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === "MISSING_TYPE"));
});

test("schema: duplicate @id flagged", () => {
  const r = validateGraph(
    graph([
      { "@type": "Thing", "@id": "x" },
      { "@type": "Thing", "@id": "x" },
    ]),
  );
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === "DUPLICATE_ID"));
});

test("schema: valid graph passes", () => {
  const r = validateGraph(graph([{ "@type": "Thing", "@id": "x" }]));
  assert.equal(r.valid, true);
  assert.deepEqual(r.issues, []);
});

test("schema: unresolved ref flagged", () => {
  const r = validateGraph(
    graph([
      { "@type": "Thing", "@id": "x", related: { "@id": "y" } },
    ]),
  );
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === "UNRESOLVED_REF"));
});

test("schema: absolute http(s) refs are accepted without in-graph match", () => {
  const r = validateGraph(
    graph([
      {
        "@type": "Thing",
        "@id": "x",
        related: { "@id": "https://example.com/y" },
      },
    ]),
  );
  assert.equal(r.valid, true);
});

test("schema: null document invalid", () => {
  const r = validateGraph(null);
  assert.equal(r.valid, false);
});
