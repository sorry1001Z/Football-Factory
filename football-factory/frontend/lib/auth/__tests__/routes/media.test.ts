// Tests for /api/automation/media (Phase 18C.1)
//
// Server-to-server media upload for the n8n FF90-04 pipeline. Mirrors
// the auth + kill-switch + rate-limit + zod + audit pattern used by
// every other automation route.
//
// Cases:
//   1. no automation secret → 401
//   2. invalid automation secret → 401
//   3. AUTOMATION_ENABLED missing/false → 503 automation_disabled
//   4. AUTOMATION_ENABLED = "true" + missing content-type → 400
//   5. AUTOMATION_ENABLED = "true" + missing file part → 400
//   6. AUTOMATION_ENABLED = "true" + WP not configured → 503 wp_write_not_configured
//   7. AUTOMATION_ENABLED = "true" + WP succeeds → 200 + wp_media_id + source_url
//   8. WP uploadMedia called exactly once with the right inputs
//   9. WP 4xx → 400 with kind=http_4xx
//  10. WP timeout/network → 502
//  11. post_id supplied + WP succeeds on both upload and attach → 200 attached=true
//  12. post_id supplied + WP succeeds on upload but fails on attach → 207 attached=false
//  13. Secret value is never echoed in the response body or metadata
//  14. Authorization header value is never written into the audit row
//  15. Audit row is written on success with action="wp_media_upload"
//
// FF90-04 workflow reference checks (no n8n execution; pure JSON scan):
//  - FF90-04 references /api/automation/media (no admin path)
//  - FF90-04 does NOT reference /api/admin/posts/media anywhere
//  - FF90-04 uses native Header Auth without blocked environment expressions
//  - FF90-04 does NOT introduce a wp-publish call

import { __resetRateLimiterForTest } from "@/lib/security/rate-limit";
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/automation/media/route";
import {
  __setDbOverrideForTest,
  __resetDbOverrideForTest,
  type Db,
} from "@/lib/db/postgres";
import { WordPressWriteError } from "@/lib/wordpress/write";
import {
  setWordPressWriteClientFactoryForTest,
  resetWordPressWriteClientFactoryForTest,
} from "@/lib/wordpress/__test-hooks__/write";

const OK_SECRET = "x".repeat(64);
const URL_BASE = "https://football-factory-three.vercel.app/api/automation/media";

beforeEach(() => {
  __resetRateLimiterForTest();
  process.env.AUTOMATION_SECRET = OK_SECRET;
  process.env.AUTOMATION_ENABLED = "true";
  process.env.WORDPRESS_REST_URL = "https://example.test/wp-json/wp/v2";
  process.env.WORDPRESS_APP_USER = "u";
  process.env.WORDPRESS_APP_PASSWORD = "p".repeat(24);
  process.env.WORDPRESS_WRITE_TIMEOUT_MS = "2000";
  process.env.DATABASE_URL = "postgres://stub";
  __setDbOverrideForTest(makeStubDb([() => ({ rows: [{ rights_confirmed: true, metadata: { rights: {
    state: "cleared", source_url: "https://images.example/source", source_name: "Example Archive",
    license_name: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0/",
    attribution_text: "Photo by Example Archive", commercial_use_confirmed: true,
  } } }], rowCount: 1 })]) as unknown as Db);
});

afterEach(() => {
  __resetDbOverrideForTest();
  resetWordPressWriteClientFactoryForTest();
});

type Row = Record<string, unknown>;

function makeStubDb(plan: Array<() => unknown>) {
  let i = 0;
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    configured: true,
    calls,
    async query<T = Row>(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      const fn = plan[i++] ?? plan[plan.length - 1];
      const r = fn();
      if (r instanceof Error) throw r;
      return r as { rows: T[]; rowCount: number | null };
    },
    async end() {},
  };
}

function makeMultipartRequest(
  options: {
    headers?: Record<string, string>;
    body?: BodyInit | null;
    contentType?: string;
  } = {},
): Request {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.contentType) headers["content-type"] = options.contentType;
  return new Request(URL_BASE, {
    method: "POST",
    headers,
    body: options.body ?? null,
  });
}

function makeMultipartForm(opts: {
  filename?: string;
  mimeType?: string;
  altText?: string;
  caption?: string;
  title?: string;
  postId?: number;
  runId?: string;
  editorialItemId?: string;
  bytes?: Uint8Array;
}): FormData {
  const form = new FormData();
  const bytes = opts.bytes ?? new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic
  // Blob's BlobPart in Node 24 expects ArrayBuffer | TypedArray with
  // ArrayBuffer-backed buffer. We hand it a fresh ArrayBuffer view
  // to avoid the SharedArrayBuffer ambiguity.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const file = new Blob([ab], {
    type: opts.mimeType ?? "image/jpeg",
  });
  form.append("file", file, opts.filename ?? "cover.jpg");
  if (opts.altText) form.append("alt_text", opts.altText);
  if (opts.caption) form.append("caption", opts.caption);
  if (opts.title) form.append("title", opts.title);
  if (opts.postId !== undefined) form.append("post_id", String(opts.postId));
  if (opts.runId) form.append("run_id", opts.runId);
  else form.append("run_id", "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7");
  if (opts.editorialItemId) form.append("editorial_item_id", opts.editorialItemId);
  else form.append("editorial_item_id", "b2c43d6e-7f80-4a91-b2c3-4d5e6f708192");
  return form;
}

async function makeMultipartRequestWithForm(
  form: FormData,
  headers: Record<string, string> = {},
): Promise<Request> {
  // Use the FormData as the body. The content-type with boundary will be
  // set automatically by the platform Request constructor.
  return new Request(URL_BASE, {
    method: "POST",
    headers,
    body: form,
  });
}

// ---------------------------------------------------------------------------
// Auth + kill-switch
// ---------------------------------------------------------------------------

test("media: missing x-automation-secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}));
  const r = await POST(req);
  assert.equal(r.status, 401);
  const body = (await r.json()) as { ok: false; error: string };
  assert.equal(body.ok, false);
});

test("media: wrong secret → 401", async () => {
  const db = makeStubDb([]);
  __setDbOverrideForTest(db as unknown as Db);
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": "wrong-secret-with-enough-length-to-pass-the-short-check",
  });
  const r = await POST(req);
  assert.equal(r.status, 401);
});

test("media: AUTOMATION_ENABLED=false → 503 automation_disabled", async () => {
  process.env.AUTOMATION_ENABLED = "false";
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 503);
  const body = (await r.json()) as { ok: false; error: string };
  assert.equal(body.error, "automation_disabled");
});

test("media: AUTOMATION_ENABLED missing → 503 automation_disabled", async () => {
  delete process.env.AUTOMATION_ENABLED;
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 503);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "automation_disabled");
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test("media: non-multipart content-type → 400 expected_multipart_form_data", async () => {
  const req = makeMultipartRequest({
    contentType: "application/json",
    headers: { "x-automation-secret": OK_SECRET },
    body: JSON.stringify({}),
  });
  const r = await POST(req);
  assert.equal(r.status, 400);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "expected_multipart_form_data");
});

test("media: missing file part → 400 missing_file_part", async () => {
  const form = new FormData();
  form.append("alt_text", "hi");
  form.append("run_id", "a1e32f5a-06ff-40ff-a1f0-148cf33e09d7");
  form.append("editorial_item_id", "b2c43d6e-7f80-4a91-b2c3-4d5e6f708192");
  const req = await makeMultipartRequestWithForm(form, {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 400);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "missing_file_part");
});

test("media: upload is refused before WordPress when rights are incomplete", async () => {
  __setDbOverrideForTest(makeStubDb([() => ({ rows: [{ rights_confirmed: false, metadata: { rights: { state: "manual_review" } } }], rowCount: 1 })]) as unknown as Db);
  let uploadCalls = 0;
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() { uploadCalls += 1; throw new Error("must not upload"); },
    async updatePost() { throw new Error("not used"); },
    async createPost() { throw new Error("not used"); },
    async trashPost() { throw new Error("not used"); },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), { "x-automation-secret": OK_SECRET });
  const res = await POST(req);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "rights_evidence_incomplete");
  assert.equal(uploadCalls, 0);
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test("media: WP not configured → 503 wp_write_not_configured", async () => {
  delete process.env.WORDPRESS_REST_URL;
  setWordPressWriteClientFactoryForTest(() => ({
    configured: false,
    async uploadMedia() {
      throw new Error("uploadMedia should not be called when not configured");
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 503);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "wp_write_not_configured");
});

test("media: successful upload → 200 + wp_media_id + source_url, uploadMedia called exactly once", async () => {
  let uploadCalls = 0;
  let updateCalls = 0;
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia(input) {
      uploadCalls++;
      assert.equal(input.filename, "cover.jpg");
      assert.equal(input.mimeType, "image/jpeg");
      assert.equal(input.title, "FF90 Cover");
      assert.equal(input.altText, "alt-x");
      assert.equal(input.caption, "cap-y");
      assert.ok(input.buffer.byteLength > 0);
      return {
        id: 4242,
        source_url: "https://cms.example.com/wp-content/uploads/2026/09/cover.jpg",
        mime_type: "image/jpeg",
      };
    },
    async updatePost() {
      updateCalls++;
      throw new Error("updatePost must NOT be called when post_id is omitted");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(
    makeMultipartForm({
      filename: "cover.jpg",
      mimeType: "image/jpeg",
      altText: "alt-x",
      caption: "cap-y",
      title: "FF90 Cover",
    }),
    { "x-automation-secret": OK_SECRET },
  );
  const r = await POST(req);
  assert.equal(r.status, 200);
  assert.equal(uploadCalls, 1, "uploadMedia must be called exactly once");
  assert.equal(updateCalls, 0, "updatePost must NOT be called without post_id");
  const body = (await r.json()) as {
    ok: true;
    wp_media_id: number;
    source_url: string;
    mime_type: string;
  };
  assert.equal(body.ok, true);
  assert.equal(body.wp_media_id, 4242);
  assert.equal(
    body.source_url,
    "https://cms.example.com/wp-content/uploads/2026/09/cover.jpg",
  );
  assert.equal(body.mime_type, "image/jpeg");
});

// ---------------------------------------------------------------------------
// WP error mapping
// ---------------------------------------------------------------------------

test("media: WP http_4xx → 400 with kind=http_4xx", async () => {
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      throw new WordPressWriteError("http_4xx", "wp_http_400", 400);
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 400);
  const body = (await r.json()) as { error: string; wp_status: number | null };
  assert.equal(body.error, "http_4xx");
  assert.equal(body.wp_status, 400);
});

test("media: WP timeout → 502 with kind=timeout", async () => {
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      throw new WordPressWriteError("timeout", "wp_timeout", null);
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 502);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "timeout");
});

test("media: WP network → 502 with kind=network", async () => {
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      throw new WordPressWriteError("network", "wp_network_error", null);
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 502);
  const body = (await r.json()) as { error: string };
  assert.equal(body.error, "network");
});

// ---------------------------------------------------------------------------
// Attach path
// ---------------------------------------------------------------------------

test("media: post_id + upload OK + attach OK → 200 attached=true", async () => {
  let updateArgs: unknown = null;
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      return { id: 500, source_url: "https://x/y.jpg", mime_type: "image/jpeg" };
    },
    async updatePost(id: number, input) {
      updateArgs = { id, input };
      return { id, status: "draft", link: "https://x" };
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(
    makeMultipartForm({ postId: 777 }),
    { "x-automation-secret": OK_SECRET },
  );
  const r = await POST(req);
  assert.equal(r.status, 200);
  const body = (await r.json()) as {
    ok: true;
    wp_media_id: number;
    attached: boolean;
    attachment: { post_id: number; featured_media: number };
  };
  assert.equal(body.attached, true);
  assert.deepEqual(body.attachment, {
    post_id: 777,
    featured_media: 500,
  });
  assert.deepEqual(updateArgs, { id: 777, input: { featured_media: 500 } });
});

test("media: post_id + upload OK + attach FAIL → 207 attached=false", async () => {
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      return { id: 600, source_url: "https://x/y.jpg", mime_type: "image/jpeg" };
    },
    async updatePost() {
      throw new WordPressWriteError("http_5xx", "wp_http_500", 500);
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(
    makeMultipartForm({ postId: 888 }),
    { "x-automation-secret": OK_SECRET },
  );
  const r = await POST(req);
  assert.equal(r.status, 207);
  const body = (await r.json()) as {
    ok: boolean;
    wp_media_id: number;
    attached: boolean;
    attach_error: string;
  };
  assert.equal(body.ok, true, "upload itself succeeded; attach is partial failure");
  assert.equal(body.wp_media_id, 600);
  assert.equal(body.attached, false);
  assert.equal(body.attach_error, "http_5xx");
});

// ---------------------------------------------------------------------------
// Secret leakage
// ---------------------------------------------------------------------------

test("media: response body never echoes the secret", async () => {
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      return { id: 700, source_url: "https://x/y.jpg", mime_type: "image/jpeg" };
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  const text = await r.text();
  assert.ok(!text.includes(OK_SECRET), "secret value must never appear in response body");
});

test("media: audit row never contains the secret or the Authorization header value", async () => {
  // Enable DB so audit insert is exercised.
  process.env.DATABASE_URL = "postgres://stub";
  const capturedInserts: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    configured: true,
    async query<T = Row>(sql: string, values: unknown[] = []) {
      capturedInserts.push({ sql, values });
      return (/SELECT rights_confirmed/i.test(sql)
        ? { rows: [{ rights_confirmed: true, metadata: { rights: { state: "cleared", source_url: "https://images.example/source", source_name: "Archive", license_name: "CC BY", license_url: "https://license.example/terms", attribution_text: "Photo by Archive", commercial_use_confirmed: true } } }] as T[], rowCount: 1 }
        : { rows: [{ id: 1 }] as T[], rowCount: 1 });
    },
    async end() {},
  };
  __setDbOverrideForTest(db as unknown as Db);

  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      return { id: 800, source_url: "https://x/y.jpg", mime_type: "image/jpeg" };
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  const r = await POST(req);
  assert.equal(r.status, 200);

  // The AutomationLogRepository inserts exactly one row per success path.
  const inserts = capturedInserts.filter((c) => /insert into audit_logs/i.test(c.sql));
  assert.ok(inserts.length >= 1, "expected at least one audit_logs insert");
  for (const ins of inserts) {
    const blob = JSON.stringify(ins.values);
    assert.ok(!blob.includes(OK_SECRET), "secret value must not be in audit row");
    assert.ok(
      !/x-automation-secret/i.test(blob),
      "secret header name must not be in audit row",
    );
  }
});

test("media: audit row has action='wp_media_upload' on success", async () => {
  process.env.DATABASE_URL = "postgres://stub";
  const captured: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    configured: true,
    async query<T = Row>(sql: string, values: unknown[] = []) {
      captured.push({ sql, values });
      return (/SELECT rights_confirmed/i.test(sql)
        ? { rows: [{ rights_confirmed: true, metadata: { rights: { state: "cleared", source_url: "https://images.example/source", source_name: "Archive", license_name: "CC BY", license_url: "https://license.example/terms", attribution_text: "Photo by Archive", commercial_use_confirmed: true } } }] as T[], rowCount: 1 }
        : { rows: [{ id: 1 }] as T[], rowCount: 1 });
    },
    async end() {},
  };
  __setDbOverrideForTest(db as unknown as Db);
  setWordPressWriteClientFactoryForTest(() => ({
    configured: true,
    async uploadMedia() {
      return { id: 900, source_url: "https://x/y.jpg", mime_type: "image/jpeg" };
    },
    async updatePost() {
      throw new Error("not used");
    },
    async createPost() {
      throw new Error("not used");
    },
    async trashPost() {
      throw new Error("not used");
    },
  }));
  const req = await makeMultipartRequestWithForm(makeMultipartForm({}), {
    "x-automation-secret": OK_SECRET,
  });
  await POST(req);
  const inserts = captured.filter((c) => /insert into audit_logs/i.test(c.sql));
  assert.ok(inserts.length >= 1);
  // values[0] is action, values[1] is run_id, the rest are bound.
  // The action column is the first parameter per AutomationLogRepository.
  const actionVal = inserts[0].values[0];
  assert.equal(actionVal, "wp_media_upload");
});

// ---------------------------------------------------------------------------
// FF90-04 workflow reference checks (static JSON scan, no n8n execution)
// ---------------------------------------------------------------------------

test("ff90-04: workflow references /api/automation/media", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const wfPath = path.join(
    process.cwd(),
    "..",
    "automation",
    "n8n",
    "workflows",
    "FF90-04-wordpress-draft.json",
  );
  const text = await fs.readFile(wfPath, "utf-8");
  assert.match(
    text,
    /\/api\/automation\/media/,
    "FF90-04 must reference the new /api/automation/media route",
  );
});

test("ff90-04: workflow does NOT reference /api/admin/posts/media anywhere", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const wfPath = path.join(
    process.cwd(),
    "..",
    "automation",
    "n8n",
    "workflows",
    "FF90-04-wordpress-draft.json",
  );
  const text = await fs.readFile(wfPath, "utf-8");
  assert.ok(
    !text.includes("/api/admin/posts/media"),
    "FF90-04 must not reference the admin-only media route anymore",
  );
});

test("ff90-04: workflow uses native Header Auth without duplicate secret headers", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const wfPath = path.join(
    process.cwd(),
    "..",
    "automation",
    "n8n",
    "workflows",
    "FF90-04-wordpress-draft.json",
  );
  const workflow = JSON.parse(await fs.readFile(wfPath, "utf-8")) as {
    nodes: Array<{
      type: string;
      parameters: {
        authentication?: string;
        genericAuthType?: string;
        headerParameters?: { parameters?: Array<{ name?: string }> };
        [key: string]: unknown;
      };
      credentials?: { httpHeaderAuth?: { name?: string } };
    }>;
  };
  const requests = workflow.nodes.filter(node => node.type === "n8n-nodes-base.httpRequest");
  assert.ok(requests.length > 0);
  for (const node of requests) {
    assert.equal(node.parameters.authentication, "genericCredentialType");
    assert.equal(node.parameters.genericAuthType, "httpHeaderAuth");
    assert.equal(node.credentials?.httpHeaderAuth?.name, "FF90 Automation Secret");
    assert.equal(
      (node.parameters.headerParameters?.parameters ?? []).some(
        header => header.name?.toLowerCase() === "x-automation-secret",
      ),
      false,
    );
    assert.doesNotMatch(JSON.stringify(node.parameters), /\$env\./);
  }
});

test("ff90-04: workflow does NOT introduce a wp-publish call", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const wfPath = path.join(
    process.cwd(),
    "..",
    "automation",
    "n8n",
    "workflows",
    "FF90-04-wordpress-draft.json",
  );
  const text = await fs.readFile(wfPath, "utf-8");
  assert.ok(
    !/\/api\/automation\/wp-publish/.test(text),
    "FF90-04 must not call wp-publish — publishing is operator-only",
  );
});
