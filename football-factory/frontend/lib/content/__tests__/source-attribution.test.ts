import test from "node:test";
import assert from "node:assert/strict";
import { extractWpSourceAttribution } from "@/lib/content/source-attribution";

test("extracts only FF90 source link as a safe clickable attribution", () => {
  const result = extractWpSourceAttribution(
    'Article body\n\n<p class="ff90-source-attribution">แหล่งข่าว: <a href="https://news.example/story?a=1&amp;b=2" rel="nofollow noopener noreferrer">News &amp; Sport</a></p>',
  );
  assert.equal(result.body, "Article body");
  assert.deepEqual(result.attribution, {
    href: "https://news.example/story?a=1&b=2",
    label: "News & Sport",
  });
});

test("renders no invented or unsafe source URL as a link", () => {
  const result = extractWpSourceAttribution(
    '<p class="ff90-source-attribution">แหล่งข่าว: Known Publisher</p>',
  );
  assert.deepEqual(result, {
    body: "",
    attribution: { href: null, label: "Known Publisher" },
  });
  const unsafe = extractWpSourceAttribution(
    '<p class="ff90-source-attribution">แหล่งข่าว: <a href="https://evil.example\" onclick=\"x" rel="nofollow noopener noreferrer">Unsafe</a></p>',
  );
  assert.equal(unsafe.attribution?.href, undefined);
});
