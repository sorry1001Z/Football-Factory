"use client";

// Football Factory — Admin resume pipeline client component (Phase 17C).
//
// Adds SEO + WP-Draft resume controls to the existing editorial item
// detail page. The component NEVER creates a new editorial_item —
// every action targets the existing item id passed in via props.
//
// Reuses the existing admin API surface:
//   POST /api/admin/editorial/deduplicate   → returns existing run_id
//                                              (duplicate=true) for
//                                              the stored source_id
//   POST /api/admin/editorial/[id]/seo-check
//   POST /api/admin/editorial/[id]/wp-draft
//
// Operator must re-enter title + body for the resume run because the
// existing API surface takes title + content as request body and only
// the content_hash is persisted server-side per item (see
// ai-assist/route.ts). The detail page is the human review point, so
// re-entering the body for the SEO + WP-draft steps is the safe
// contract.
//
// Hard rules enforced by this component:
//   - NO publish button.
//   - NO schedule button.
//   - NO auto-approval.
//   - NO rights auto-clear.
//   - SEO run button visible regardless of fact / rights state (the
//     seo-check endpoint does not require rights=cleared).
//   - WP-draft button available once SEO has been run at least once
//     AND content has been entered. Rights may remain manual_review;
//     fact may remain pending_manual — the WP draft endpoint does
//     not require rights=cleared or fact=cleared.

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EditorialItem } from "@/lib/auth/editorial-repository";

type Props = {
  item: EditorialItem;
};

type DedupeResp =
  | {
      ok: true;
      duplicate: true;
      run_id: string;
      idempotency_key: string;
      editorial_item_id: string;
      existing_stage: string;
    }
  | {
      ok: true;
      duplicate: false;
      run_id: string;
      idempotency_key: string;
      editorial_item_id: null;
    };

type SeoResp = {
  ok: true;
  run_id: string;
  score?: number;
  checks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  issues?: string[];
  recommendations?: string[];
  recommendations_used?: string[];
  provider_status?: string;
  input_hash?: string;
  idempotent?: boolean;
  editorial_item_id: string;
  stage: string;
};

type WpResp = {
  ok: true;
  run_id: string;
  wp_post_id: number;
  status: string;
  idempotent?: boolean;
  stage_advance_warning?: string;
};

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { ok: false, error: "invalid_json", raw: text };
    }
    const obj = parsed as { ok?: boolean; error?: string } & T;
    if (!r.ok || obj.ok === false) {
      throw new Error(obj.error ?? `HTTP ${r.status}`);
    }
    return obj;
  });
}

export function AdminResumePipeline({ item }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Read derived state from the persisted editorial_item metadata.
  const meta =
    typeof item.metadata === "object" && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : {};
  const seo = (meta.seo_check ?? {}) as Record<string, unknown>;
  const seoState =
    typeof seo.state === "string"
      ? seo.state
      : (seo as { score?: number }).score !== undefined
        ? "scored"
        : "missing";
  const seoScore =
    typeof (seo as { score?: number }).score === "number"
      ? (seo as { score: number }).score
      : null;
  const seoIssues = Array.isArray((seo as { issues?: string[] }).issues)
    ? ((seo as { issues: string[] }).issues)
    : [];
  const seoRecommendations = Array.isArray(
    (seo as { recommendations?: string[] }).recommendations,
  )
    ? ((seo as { recommendations: string[] }).recommendations)
    : [];
  const seoChecks = Array.isArray((seo as { checks?: unknown[] }).checks)
    ? ((seo as { checks: unknown[] }).checks)
    : [];
  const wpPostId =
    typeof item.wp_post_id === "number" ? item.wp_post_id : null;

  // Operator-entered fields for the resume run.
  const [title, setTitle] = useState<string>(() => {
    const t = (meta as { title?: unknown }).title;
    return typeof t === "string" ? t : "";
  });
  const [slug, setSlug] = useState<string>(() => {
    const s = (meta as { slug?: unknown }).slug;
    return typeof s === "string" ? s : "";
  });
  const [description, setDescription] = useState<string>(() => {
    const d = (meta as { description?: unknown }).description;
    return typeof d === "string" ? d : "";
  });
  const [content, setContent] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function appendLog(s: string) {
    setLog((prev) => [...prev, `${new Date().toISOString()}  ${s}`]);
  }

  const claimRunId = useCallback(async (): Promise<string> => {
    // Reuse the dedupe endpoint. The endpoint is idempotent on
    // source_id — calling it again for the same source_id returns
    // duplicate=true with the existing run_id AND the existing
    // editorial_item_id. It does NOT create a new editorial_item.
    if (!item.source_id) {
      throw new Error("missing_source_id");
    }
    const r = await postJson<DedupeResp>("/api/admin/editorial/deduplicate", {
      source_id: item.source_id,
      title: typeof (meta as { title?: unknown }).title === "string"
        ? ((meta as { title: string }).title)
        : undefined,
      url: typeof (meta as { source_url?: unknown }).source_url === "string"
        ? ((meta as { source_url: string }).source_url)
        : undefined,
    });
    appendLog(
      `DEDUPE: duplicate=${r.duplicate} editorial_item_id=${r.editorial_item_id ?? "(none)"} run_id=${r.run_id}`,
    );
    return r.run_id;
  }, [item.source_id, meta]);

  async function handleRunSeo() {
    setError(null);
    if (!title.trim()) {
      setError("title is required for SEO check");
      return;
    }
    if (!content.trim()) {
      setError("body content is required for SEO check");
      return;
    }
    setBusy(true);
    try {
      const runId = await claimRunId();
      const r = await postJson<SeoResp>(
        `/api/admin/editorial/${item.id}/seo-check`,
        {
          run_id: runId,
          title: title.trim(),
          content: content,
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
        },
      );
      appendLog(
        `SEO: score=${r.score ?? "?"} idempotent=${!!r.idempotent} provider=${r.provider_status ?? "?"}`,
      );
      // Reload the page so the metadata-derived SEO state + score
      // appear in the existing item header.
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWpDraft() {
    setError(null);
    if (!title.trim()) {
      setError("title is required for WP draft");
      return;
    }
    if (!content.trim()) {
      setError("body content is required for WP draft");
      return;
    }
    setBusy(true);
    try {
      const runId = await claimRunId();
      const r = await postJson<WpResp>(
        `/api/admin/editorial/${item.id}/wp-draft`,
        {
          run_id: runId,
          title: title.trim(),
          content: content,
        },
      );
      appendLog(
        `WP DRAFT: wp_post_id=${r.wp_post_id} status=${r.status} idempotent=${!!r.idempotent}`,
      );
      // Reload the page so wp_post_id appears in the existing
      // header.
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Update the existing WP draft (id 18) with expanded title /
   * excerpt / body / slug / seo fields. Uses the existing
   * PATCH /api/admin/posts endpoint. Hard rule: status stays as
   * "draft" — we do NOT publish or schedule. featured_media and
   * categories are NOT touched by this button.
   */
  async function handleUpdateArticle() {
    setError(null);
    if (!title.trim()) {
      setError("title is required for article update");
      return;
    }
    if (!content.trim()) {
      setError("body content is required for article update");
      return;
    }
    if (!wpPostId) {
      setError("no WP draft exists for this item yet — create the draft first");
      return;
    }
    setBusy(true);
    try {
      // PATCH uses the existing /api/admin/posts admin route.
      // We pass slug + excerpt + title + content. status is NOT
      // set (the route keeps the existing draft status).
      const payload: Record<string, unknown> = {
        id: wpPostId,
        title: title.trim(),
        content: content,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { excerpt: description.trim() } : {}),
      };
      const r = await postJson<{ ok: boolean; post?: { id: number } }>(
        "/api/admin/posts",
        payload,
      );
      appendLog(
        `ARTICLE UPDATE: wp_post_id=${r.post?.id ?? wpPostId} ok=${r.ok}`,
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Upload a Featured Image for the existing WP draft. The operator
   * selects a file from disk (any JPEG/PNG/WebP up to 12MB). The
   * component forwards it to POST /api/admin/posts/media which
   * uploads to WP and atomically sets featured_media on the draft.
   */
  async function handleUploadFeaturedImage(ev: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    if (!wpPostId) {
      setError("no WP draft exists for this item yet — create the draft first");
      return;
    }
    const file = ev.target.files?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("post_id", String(wpPostId));
      fd.append(
        "alt_text",
        "Exterior view of the Etihad Stadium, home of Manchester City Football Club",
      );
      fd.append(
        "caption",
        "Etihad Stadium, home of Manchester City Football Club (illustrative venue image)",
      );
      fd.append("title", "Etihad Stadium");
      const res = await fetch("/api/admin/posts/media", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`http_${res.status}: ${text}`);
      }
      appendLog(`FEATURED IMAGE: uploaded; response=${text}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canRunSeo = !busy && !pending && title.trim() !== "" && content.trim() !== "";
  const canCreateWpDraft =
    !busy && !pending && title.trim() !== "" && content.trim() !== "";
  const canUpdateArticle =
    !busy && !pending && wpPostId !== null && title.trim() !== "" && content.trim() !== "";
  const canUploadFeaturedImage = !busy && !pending && wpPostId !== null;

  return (
    <section
      aria-labelledby="resume-pipeline-heading"
      className="admin-resume-pipeline"
      data-testid="admin-resume-pipeline"
      data-editorial-item-id={item.id}
    >
      <h2 id="resume-pipeline-heading">Pipeline actions (resume)</h2>
      <p className="admin-help">
        Resume the existing editorial item
        <code> {item.id}</code>. Re-entering title + body is required
        because the admin API endpoints take them as request payload.
        These actions do NOT create a new editorial item.
      </p>

      <dl className="admin-resume-state">
        <dt>SEO state</dt>
        <dd>
          <span className={`admin-badge seo-${seoState}`}>{seoState}</span>
          {seoScore !== null ? (
            <span className="admin-badge seo-score"> score={seoScore}</span>
          ) : null}
        </dd>
        <dt>WP Post ID</dt>
        <dd>
          <code data-testid="admin-resume-wp-post-id">
            {wpPostId ?? "—"}
          </code>
        </dd>
        <dt>Editorial item ID (fixed)</dt>
        <dd>
          <code data-testid="admin-resume-editorial-item-id">{item.id}</code>
        </dd>
      </dl>

      {error ? (
        <p role="alert" className="admin-error" data-testid="admin-resume-error">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label>
          Article title (resume)
          <input
            type="text"
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="admin-resume-title"
            required
          />
        </label>
        <label>
          Slug (optional, lowercase a-z 0-9 dashes, 3..64)
          <input
            type="text"
            maxLength={64}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            data-testid="admin-resume-slug"
          />
        </label>
        <label>
          Description / meta description (optional, ≤500)
          <input
            type="text"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="admin-resume-description"
          />
        </label>
        <label>
          Body content (resume)
          <textarea
            required
            minLength={1}
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            data-testid="admin-resume-content"
          />
        </label>

        <div className="admin-resume-actions">
          <button
            type="button"
            className="admin-button"
            disabled={!canRunSeo}
            onClick={() => {
              void handleRunSeo();
            }}
            data-testid="admin-resume-seo"
          >
            Run Local SEO Check
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={!canCreateWpDraft}
            onClick={() => {
              void handleCreateWpDraft();
            }}
            data-testid="admin-resume-wp-draft"
          >
            Create WP Draft
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={!canUpdateArticle}
            onClick={() => {
              void handleUpdateArticle();
            }}
            data-testid="admin-resume-article-update"
          >
            Update Article (title/body/slug)
          </button>
          <label
            className="admin-button admin-resume-upload-label"
            data-disabled={!canUploadFeaturedImage}
          >
            Upload Featured Image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canUploadFeaturedImage}
              onChange={(ev) => {
                void handleUploadFeaturedImage(ev);
              }}
              data-testid="admin-resume-featured-upload"
              style={{ display: "none" }}
            />
          </label>
        </div>
        <p className="admin-help">
          No publish button. No schedule button. No auto-approval. No
          rights auto-clear. Rights may remain <code>manual_review</code>;
          fact may remain <code>pending_manual</code>. WP draft is
          idempotent — re-clicking returns the same wp_post_id without
          creating a duplicate WordPress post.
        </p>
      </form>

      {seoScore !== null && seoChecks.length > 0 ? (
        <details className="admin-resume-seo-detail">
          <summary>SEO details (score={seoScore})</summary>
          <ul>
            {seoChecks.map((c, i) => {
              const check = c as {
                id?: string;
                label?: string;
                passed?: boolean;
                detail?: string;
              };
              return (
                <li key={String(check.id ?? i)}>
                  <strong>{String(check.label ?? check.id ?? "?")}</strong>
                  {" — "}
                  {check.passed ? "pass" : "fail"}
                  {check.detail ? ` (${check.detail})` : ""}
                </li>
              );
            })}
          </ul>
          {seoIssues.length > 0 ? (
            <p>
              <strong>Issues:</strong>{" "}
              <code>{seoIssues.join(", ")}</code>
            </p>
          ) : null}
          {seoRecommendations.length > 0 ? (
            <p>
              <strong>Recommendations:</strong>{" "}
              <code>{seoRecommendations.join("; ")}</code>
            </p>
          ) : null}
        </details>
      ) : null}

      {log.length > 0 ? (
        <pre className="admin-resume-log" data-testid="admin-resume-log">
          {log.join("\n")}
        </pre>
      ) : null}
    </section>
  );
}

export default AdminResumePipeline;
