// Tests for the CSRF check (FIRST SLICE).
//
// Covers:
//   - automation-secret header short-circuits CSRF (returns ok)
//   - Sec-Fetch-Site same-origin / same-site → ok
//   - Sec-Fetch-Site cross-site → reject
//   - Origin matches NEXT_PUBLIC_SITE_URL host → ok
//   - Origin mismatch → reject
//   - No origin and no expected host (NEXT_PUBLIC_SITE_URL unset) → ok
//   - No origin and expected host set → reject

import test from "node:test";
import assert from "node:assert/strict";
import { checkCsrf } from "@/lib/security/csrf";

function makeRequest(headers: Record<string, string>): Request {
  const h = new Headers(headers);
  return new Request("https://example.com/api/test", { method: "POST", headers: h });
}

test("csrf: x-automation-secret short-circuits CSRF (returns ok)", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(
    makeRequest({
      "x-automation-secret": "anyvalue",
      origin: "https://evil.example",
    }),
  );
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, true);
});

test("csrf: Sec-Fetch-Site same-origin → ok", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({ "sec-fetch-site": "same-origin" }));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, true);
});

test("csrf: Sec-Fetch-Site same-site → ok", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({ "sec-fetch-site": "same-site" }));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, true);
});

test("csrf: Sec-Fetch-Site cross-site → reject", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({ "sec-fetch-site": "cross-site" }));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "fetch_site_invalid");
});

test("csrf: origin matches expected host → ok", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({ origin: "https://www.example.com" }));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, true);
});

test("csrf: origin mismatch → reject", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({ origin: "https://evil.example" }));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "origin_mismatch");
});

test("csrf: no origin and NEXT_PUBLIC_SITE_URL unset → ok", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const r = checkCsrf(makeRequest({}));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, true);
});

test("csrf: no origin and expected host set → reject", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  const r = checkCsrf(makeRequest({}));
  process.env.NEXT_PUBLIC_SITE_URL = prev;
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "no_origin");
});
