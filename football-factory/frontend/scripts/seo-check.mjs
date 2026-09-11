#!/usr/bin/env node
/**
 * Football Factory — SEO canonical/JSON-LD probe.
 *
 * Adapted from the external Production Gates Pack (Pack 1).
 *
 * Usage:
 *   npm run smoke:seo
 *
 * Behavior:
 *   - Fetches the canonical article page (or ARTICLE_PATH override).
 *   - Asserts:
 *     - <title> exists
 *     - canonical <link rel="canonical"> exists
 *     - canonical uses NEXT_PUBLIC_SITE_URL (no localhost / 127.0.0.1 /
 *       trycloudflare in the canonical href)
 *     - NewsArticle JSON-LD block exists
 *     - description meta exists
 *     - public SEO fields do not leak forbidden hosts
 *   - Exits 0 on PASS, 1 on FAIL.
 *   - Never prints credentials.
 *
 * Note on trycloudflare:
 *   - The WP health endpoint (`/api/health/wordpress?probe=1`) reports the
 *     tunnel host as `endpoint_host`. That is an infrastructure
 *     metadata field, NOT a canonical URL or public SEO field.
 *   - This script does NOT probe `/api/health/wordpress` to avoid false
 *     positives from the WP backend infrastructure.
 *   - The script DOES check that the article page's <link rel=canonical>
 *     and JSON-LD do not contain forbidden hosts.
 */
import process from "node:process";

const base = (process.env.BASE_URL || "https://football-factory-three.vercel.app").replace(/\/$/, "");
const articlePath = process.env.ARTICLE_PATH || "/news/phase-3-test";
const url = base + articlePath;

const forbidden = /(localhost|127\.0\.0\.1|trycloudflare)/i;

let html;
try {
  const r = await fetch(url, { redirect: "manual" });
  if (!r.ok) {
    console.error(`FAIL: GET ${url} returned HTTP ${r.status}`);
    process.exit(1);
  }
  html = await r.text();
} catch (e) {
  console.error(`FAIL: GET ${url} errored: ${e?.message || e}`);
  process.exit(1);
}

const checks = {
  title: /<title>[^<]+<\/title>/i.test(html),
  description: /<meta\s+name=["']description["'][^>]*>/i.test(html),
  canonicalLink: /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html),
  newsArticle: /"@type"\s*:\s*"NewsArticle"/i.test(html),
  canonicalPublicOrigin:
    (() => {
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      if (!m) return false;
      const href = m[1];
      // canonical must start with our public site URL
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://football-factory-three.vercel.app";
      if (!href.startsWith(site)) return false;
      // canonical must not contain forbidden hosts
      if (forbidden.test(href)) return false;
      return true;
    })(),
  noForbiddenInCanonical:
    (() => {
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      if (!m) return true; // already failed canonical check
      return !forbidden.test(m[1]);
    })(),
  noForbiddenInJsonLd:
    (() => {
      // Extract every JSON-LD block and check its body for forbidden hosts.
      const blocks = [];
      const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = re.exec(html))) blocks.push(m[1]);
      return blocks.every((b) => !forbidden.test(b));
    })(),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(`  URL:    ${url}`);
console.log(`  bytes:  ${html.length}`);
console.log();
for (const [k, ok] of Object.entries(checks)) {
  console.log(`  ${k.padEnd(28)} ${ok ? "OK" : "FAIL"}`);
}
console.log();
if (failed.length > 0) {
  console.error(`FAIL: ${failed.length} check(s) failed: ${failed.map(([k]) => k).join(", ")}`);
  process.exit(1);
}
console.log("PASS");
