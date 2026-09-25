// Tests for the WordPress write client (FIRST SLICE).
//
// Covers:
//   - constructor: configured=false when env not set
//   - constructor: configured=true when env set
//   - createPost defaults to draft when status omitted
//   - createPost REJECTS status='publish' (must use human-approval)
//   - updatePost rejects invalid status
//   - updatePost: status not in payload → status NOT sent to WP
//   - trashPost uses force=false (no force delete)
//
// We use a fake `fetch` injected via globalThis.fetch to avoid network.

import test from "node:test";
import assert from "node:assert/strict";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function setupFetchReturning(
  status: number,
  body: unknown,
): { fetch: typeof fetch; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    }
    let bodyText = "";
    if (typeof init?.body === "string") {
      bodyText = init.body;
    } else if (init?.body instanceof Buffer) {
      bodyText = init.body.toString("utf8");
    } else if (init?.body instanceof Uint8Array) {
      bodyText = Buffer.from(init.body).toString("utf8");
    } else if (init?.body instanceof ArrayBuffer) {
      bodyText = Buffer.from(new Uint8Array(init.body)).toString("utf8");
    }
    calls.push({ url, method, headers, body: bodyText });
    const init2: { status: number; statusText: string } = {
      status,
      statusText: status === 200 ? "OK" : status === 201 ? "Created" : "Error",
    };
    return new Response(JSON.stringify(body), init2);
  }) as unknown as typeof fetch;
  return {
    fetch: ((...args: Parameters<typeof fetch>) =>
      (globalThis.fetch as unknown as typeof fetch)(...args)) as typeof fetch,
    calls,
  };
}

function setEnv(): void {
  process.env.WORDPRESS_REST_URL = "https://cms.example.com/wp-json/wp/v2";
  process.env.WORDPRESS_APP_USER = "automation";
  process.env.WORDPRESS_APP_PASSWORD = "abcd efgh ijkl mnop qrst uvwx";
  process.env.WORDPRESS_WRITE_TIMEOUT_MS = "4000";
}

function clearEnv(): void {
  delete process.env.WORDPRESS_REST_URL;
  delete process.env.WORDPRESS_APP_USER;
  delete process.env.WORDPRESS_APP_PASSWORD;
  delete process.env.WORDPRESS_WRITE_TIMEOUT_MS;
}

test("wp-write: configured=false when env unset", () => {
  clearEnv();
  const c = new WordPressWriteClient();
  assert.equal(c.configured, false);
});

test("wp-write: configured=true when env set", () => {
  setEnv();
  const c = new WordPressWriteClient();
  assert.equal(c.configured, true);
  clearEnv();
});

test("wp-write: createPost defaults to draft when status omitted", async () => {
  setEnv();
  const { calls } = setupFetchReturning(201, { id: 123, status: "draft" });
  const c = new WordPressWriteClient();
  const post = await c.createPost({ title: "Hello", content: "Body" });
  assert.equal(post.id, 123);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/posts$/);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.status, "draft");
  assert.equal(body.title, "Hello");
  assert.equal(body.content, "Body");
  clearEnv();
});

test("wp-write: draft maps excerpt and slug and omits unmapped taxonomy IDs", async () => {
  setEnv();
  const { calls } = setupFetchReturning(201, { id: 124, status: "draft" });
  const c = new WordPressWriteClient();
  await c.createPost({
    title: "หัวข้อ",
    content: "เนื้อหา",
    excerpt: "คำโปรย",
    slug: "sample-story",
    status: "draft",
  });
  const body = JSON.parse(calls[0].body);
  assert.equal(body.title, "หัวข้อ");
  assert.equal(body.content, "เนื้อหา");
  assert.equal(body.excerpt, "คำโปรย");
  assert.equal(body.slug, "sample-story");
  assert.equal(body.status, "draft");
  assert.equal("categories" in body, false);
  assert.equal("tags" in body, false);
  clearEnv();
});

test("wp-write: createPost REJECTS status='publish'", async () => {
  setEnv();
  const c = new WordPressWriteClient();
  await assert.rejects(
    () =>
      c.createPost({ title: "Hello", content: "Body", status: "publish" }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "http_4xx",
  );
  clearEnv();
});

test("wp-write: updatePost with omitted status does NOT include status in body", async () => {
  setEnv();
  const { calls } = setupFetchReturning(200, { id: 1, status: "draft" });
  const c = new WordPressWriteClient();
  await c.updatePost(1, { title: "New" });
  const body = JSON.parse(calls[0].body);
  assert.equal(body.title, "New");
  assert.equal(
    "status" in body,
    false,
    "status must not be sent if not in payload",
  );
  clearEnv();
});

test("wp-write: updatePost rejects invalid status", async () => {
  setEnv();
  const c = new WordPressWriteClient();
  await assert.rejects(
    // @ts-expect-error - intentionally bad status
    () => c.updatePost(1, { status: "invalid" }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "http_4xx",
  );
  clearEnv();
});

test("wp-write: trashPost uses force=false (no force delete)", async () => {
  setEnv();
  const { calls } = setupFetchReturning(200, { id: 1, status: "trash" });
  const c = new WordPressWriteClient();
  await c.trashPost(1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  assert.match(calls[0].url, /force=false/);
  clearEnv();
});

test("wp-write: not_configured throws when createPost called without env", async () => {
  clearEnv();
  const c = new WordPressWriteClient();
  await assert.rejects(
    () => c.createPost({ title: "t", content: "c" }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "not_configured",
  );
});

test("wp-write: 4xx WP response surfaces as http_4xx", async () => {
  setEnv();
  setupFetchReturning(403, { code: "forbidden" });
  const c = new WordPressWriteClient();
  await assert.rejects(
    () => c.createPost({ title: "t", content: "c" }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "http_4xx",
  );
  clearEnv();
});

test("wp-write: 5xx WP response surfaces as http_5xx (route should 502)", async () => {
  setEnv();
  setupFetchReturning(500, "internal error");
  const c = new WordPressWriteClient();
  await assert.rejects(
    () => c.createPost({ title: "t", content: "c" }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "http_5xx",
  );
  clearEnv();
});

// ============================================================
// PHASE 17D — uploadMedia tests
// ============================================================

test("wp-write: uploadMedia sends multipart/form-data with file part", async () => {
  setEnv();
  const { calls } = setupFetchReturning(201, { id: 999, source_url: "https://x/y.jpg" });
  const c = new WordPressWriteClient();
  const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const m = await c.uploadMedia({
    buffer: buf,
    filename: "test.jpg",
    mimeType: "image/jpeg",
    title: "Test image",
    altText: "alt",
    caption: "cap",
  });
  assert.equal(m.id, 999);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/media$/);
  // Multipart body must contain file + alt_text + caption + title parts.
  assert.match(calls[0].body, /Content-Disposition: form-data; name="file"/);
  assert.match(calls[0].body, /filename="test.jpg"/);
  assert.match(calls[0].body, /Content-Type: image\/jpeg/);
  assert.match(calls[0].body, /name="alt_text"/);
  assert.match(calls[0].body, /name="caption"/);
  assert.match(calls[0].body, /name="title"/);
  assert.match(calls[0].headers["content-type"], /^multipart\/form-data; boundary=/);
  // Authorization header must be present (basic auth).
  assert.match(calls[0].headers["authorization"], /^Basic /);
  clearEnv();
});

test("wp-write: uploadMedia throws not_configured when env missing", async () => {
  clearEnv();
  const c = new WordPressWriteClient();
  await assert.rejects(
    () =>
      c.uploadMedia({
        buffer: new Uint8Array([1]),
        filename: "x.jpg",
        mimeType: "image/jpeg",
      }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "not_configured",
  );
});

test("wp-write: uploadMedia surfaces http_5xx from WP", async () => {
  setEnv();
  setupFetchReturning(500, { code: "internal" });
  const c = new WordPressWriteClient();
  await assert.rejects(
    () =>
      c.uploadMedia({
        buffer: new Uint8Array([1]),
        filename: "x.jpg",
        mimeType: "image/jpeg",
      }),
    (e: unknown) =>
      e instanceof WordPressWriteError && e.kind === "http_5xx",
  );
  clearEnv();
});
