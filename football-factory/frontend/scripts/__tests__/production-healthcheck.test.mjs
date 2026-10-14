import test from "node:test";
import assert from "node:assert/strict";
import { runProductionHealthcheck } from "../production-healthcheck.mjs";

function fakeFetch({ wordpressReachable = true, articleStatus = 200 } = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/health") return Response.json({ status: "ok", service: "football-factory-frontend" });
    if (path === "/api/health/wordpress") return Response.json({ configured: true, reachable: wordpressReachable });
    if (path === "/") return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    if (path === "/robots.txt" || path === "/sitemap.xml") return new Response("ok", { status: 200 });
    if (path.startsWith("/news/")) return new Response("article", { status: articleStatus });
    return new Response("missing", { status: 404 });
  };
}

test("production healthcheck passes only with live WordPress and published article", async () => {
  const result = await runProductionHealthcheck({
    baseUrl: "https://example.test",
    articlePath: "/news/known-published-slug",
    fetchImpl: fakeFetch(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.checks.every((check) => check.status === "PASS"), true);
});

test("healthcheck fails closed when WordPress is unreachable or article returns 404", async () => {
  const result = await runProductionHealthcheck({
    baseUrl: "https://example.test",
    articlePath: "/news/known-published-slug",
    fetchImpl: fakeFetch({ wordpressReachable: false, articleStatus: 404 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((check) => check.name === "wordpress_read_path")?.status, "FAIL");
  assert.equal(result.checks.find((check) => check.name === "published_article")?.status, "FAIL");
});

test("healthcheck marks missing article acceptance as NOT TESTED", async () => {
  const result = await runProductionHealthcheck({ baseUrl: "https://example.test", fetchImpl: fakeFetch() });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((check) => check.name === "published_article")?.status, "NOT TESTED");
});

test("healthcheck rejects URLs containing credentials", async () => {
  const result = await runProductionHealthcheck({ baseUrl: "https://user:password@example.test", fetchImpl: fakeFetch() });
  assert.equal(result.ok, false);
  assert.equal(result.checks[0].status, "FAIL");
});
