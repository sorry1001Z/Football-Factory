#!/usr/bin/env node
/** Read-only release probe. Requires an explicit BASE_URL to prevent accidental targeting. */
import process from "node:process";

const TIMEOUT_MS = 5_000;

export async function runProductionHealthcheck({ baseUrl, articlePath, fetchImpl = fetch }) {
  let base;
  try {
    base = new URL(baseUrl);
    if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error();
  } catch {
    return { ok: false, checks: [{ name: "base_url", status: "FAIL", detail: "Set a valid BASE_URL without credentials." }] };
  }

  const checks = [];
  async function get(path) {
    try {
      const response = await fetchImpl(new URL(path, base), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      return response;
    } catch {
      return null;
    }
  }

  const healthResponse = await get("/api/health");
  let health = null;
  if (healthResponse?.status === 200) {
    try { health = await healthResponse.json(); } catch { /* shape check below fails closed */ }
  }
  checks.push({
    name: "frontend_health",
    status: health?.status === "ok" && health?.service === "football-factory-frontend" ? "PASS" : "FAIL",
    detail: healthResponse ? `HTTP ${healthResponse.status}; body contract ${health?.status === "ok" ? "valid" : "invalid"}` : "Request failed or timed out.",
  });

  const home = await get("/");
  checks.push({
    name: "homepage",
    status: home?.status === 200 && (home.headers.get("content-type") || "").includes("text/html") ? "PASS" : "FAIL",
    detail: home ? `HTTP ${home.status}; HTML ${String(home.headers.get("content-type") || "").includes("text/html") ? "yes" : "no"}` : "Request failed or timed out.",
  });

  const wordpressResponse = await get("/api/health/wordpress?probe=1");
  let wordpress = null;
  if (wordpressResponse?.status === 200) {
    try { wordpress = await wordpressResponse.json(); } catch { /* shape check below fails closed */ }
  }
  const wpReady = wordpress?.configured === true && wordpress?.reachable === true;
  checks.push({
    name: "wordpress_read_path",
    status: wpReady ? "PASS" : "FAIL",
    detail: wordpressResponse
      ? `HTTP ${wordpressResponse.status}; configured=${wordpress?.configured === true}; reachable=${wordpress?.reachable === true}`
      : "Request failed or timed out.",
  });

  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const response = await get(path);
    checks.push({
      name: path,
      status: response?.status === 200 ? "PASS" : "FAIL",
      detail: response ? `HTTP ${response.status}` : "Request failed or timed out.",
    });
  }

  if (articlePath) {
    if (!articlePath.startsWith("/news/") || articlePath.includes("..") || articlePath.includes("\\")) {
      checks.push({ name: "published_article", status: "FAIL", detail: "Article path must be a safe /news/<slug> path." });
    } else {
      const response = await get(articlePath);
      checks.push({
        name: "published_article",
        status: response?.status === 200 ? "PASS" : "FAIL",
        detail: response ? `HTTP ${response.status}` : "Request failed or timed out.",
      });
    }
  } else {
    checks.push({ name: "published_article", status: "NOT TESTED", detail: "Set ARTICLE_PATH to a known published /news/<slug>." });
  }

  return { ok: checks.every((check) => check.status === "PASS"), checks };
}

if (process.argv[1]?.replaceAll("\\", "/").toLowerCase().endsWith("/scripts/production-healthcheck.mjs")) {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    console.error("BLOCKED: set BASE_URL explicitly; this probe never chooses a target by default.");
    process.exit(2);
  }
  const result = await runProductionHealthcheck({ baseUrl, articlePath: process.env.ARTICLE_PATH });
  for (const check of result.checks) console.log(`${check.status.padEnd(11)} ${check.name.padEnd(24)} ${check.detail}`);
  process.exit(result.ok ? 0 : 1);
}
