import test from "node:test";
import assert from "node:assert/strict";
import { buildEditorialWpFields } from "@/lib/automation/wp-draft-editorial-fields";

test("saved editorial content maps title, body, excerpt, slug and clickable source attribution", () => {
  const result = buildEditorialWpFields({
    fallbackTitle: "workflow title",
    fallbackContent: "workflow body",
    metadata: {
      title_th: "หัวข้อจริง",
      body_th: "เนื้อหาจริง",
      excerpt_th: "คำโปรยจริง",
      slug: "real-story",
      source_url: "https://news.example/story?id=2&x=1",
      source_title: "แหล่ง <ข่าว>",
      publisher: "สำนักข่าว",
    },
  });
  assert.equal(result.title, "หัวข้อจริง");
  assert.match(result.content, /^เนื้อหาจริง/);
  assert.equal(result.excerpt, "คำโปรยจริง");
  assert.equal(result.slug, "real-story");
  assert.match(result.content, /href="https:\/\/news\.example\/story\?id=2&amp;x=1"/);
  assert.match(result.content, /แหล่ง &lt;ข่าว&gt; — สำนักข่าว/);
  assert.match(result.content, /rel="nofollow noopener noreferrer"/);
});

test("optional editorial fields stay absent and unsafe or invented source links are never generated", () => {
  const noFields = buildEditorialWpFields({
    fallbackTitle: "title",
    fallbackContent: "body",
    fallbackExcerpt: "optional excerpt",
    fallbackSlug: "optional-story",
    metadata: {},
  });
  assert.deepEqual(noFields, { title: "title", content: "body", excerpt: "optional excerpt", slug: "optional-story" });

  const sourceWithoutUrl = buildEditorialWpFields({
    fallbackTitle: "title",
    fallbackContent: "body",
    metadata: { source_title: "Known article", publisher: "Known publisher", source_url: "javascript:alert(1)" },
  });
  assert.match(sourceWithoutUrl.content, /แหล่งข่าว: Known article — Known publisher/);
  assert.doesNotMatch(sourceWithoutUrl.content, /href=/i);
  assert.doesNotMatch(sourceWithoutUrl.content, /https:\/\//);
});
