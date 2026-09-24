"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EditorialItem } from "@/lib/auth/editorial-repository";

type RunView = { id: string; status: string; stage: string | null; output: unknown; input: unknown } | null;
type FormState = {
  title_th: string;
  body_th: string;
  excerpt_th: string;
  slug: string;
  news_type: string;
  source_url: string;
  source_title: string;
  publisher: string;
  author: string;
};

const NEWS_TYPES = ["RESULT", "PREVIEW", "ANALYSIS", "TRANSFER", "BREAKING"] as const;

async function postJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let result: Record<string, unknown> = {};
  try { result = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* handled below */ }
  if (!response.ok || result.ok === false) {
    const error = typeof result.error === "string" ? result.error : `http_${response.status}`;
    throw Object.assign(new Error(error), { detail: result });
  }
  return result;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }

export function AdminEditorialCompletion({ item, run }: { item: EditorialItem; run: RunView }) {
  const router = useRouter();
  const metadata = useMemo(() => record(item.metadata), [item.metadata]);
  const runInput = useMemo(() => record(run?.input), [run?.input]);
  const output = useMemo(() => record(run?.output), [run?.output]);
  const [form, setForm] = useState<FormState>(() => ({
    title_th: stringValue(metadata.title_th),
    body_th: stringValue(metadata.body_th),
    excerpt_th: stringValue(metadata.excerpt_th),
    slug: stringValue(metadata.slug),
    news_type: stringValue(metadata.news_type),
    source_url: stringValue(metadata.source_url) || stringValue(runInput.source_url),
    source_title: stringValue(metadata.source_title) || stringValue(runInput.source_title),
    publisher: stringValue(metadata.publisher) || stringValue(metadata.source_name) || stringValue(runInput.publisher),
    author: stringValue(metadata.author) || stringValue(runInput.author),
  }));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const held = run?.status === "held_for_content";
  const wpPostId = item.wp_post_id ?? (typeof output.wp_post_id === "number" ? output.wp_post_id : null);

  function update(field: keyof FormState, value: string) {
    setSaved(false);
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function payload() {
    return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
  }

  async function saveContent() {
    setBusy(true); setError(null); setNotice(null);
    try {
      await postJson(`/api/admin/editorial/${item.id}/content`, "PATCH", payload());
      setSaved(true);
      setNotice("Editorial content and source attribution saved to this item.");
      router.refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  }

  async function dispatch(id: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await postJson(`/api/admin/automation/runs/${run?.id}/recover/dispatch`, "POST", { recovery_id: id });
      setNotice("Resume request sent to MASTER. The run is still in progress; refresh to view its status.");
      router.refresh();
    } catch (cause) {
      setError(`Recovery ${id} remains queued; dispatch did not complete (${(cause as Error).message}). Check run status before retrying.`);
    } finally { setBusy(false); }
  }

  async function requestResume() {
    if (!run) return;
    if (!saved) { setError("Save the editorial content before requesting resume."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await postJson(`/api/admin/automation/runs/${run.id}/recover`, "POST", {
        reason: "Operator completed real-news editorial content",
        dry_run: false,
      });
      const id = typeof result.recovery_id === "string" ? result.recovery_id : null;
      if (!id) throw new Error("recovery_id_missing");
      setRecoveryId(id);
      setNotice(`Recovery ${id} queued for the same run. Dispatching to MASTER…`);
      setBusy(false);
      await dispatch(id);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  const sourceText = stringValue(metadata.source_text) || stringValue(runInput.source_text);
  const sourceUrl = stringValue(metadata.source_url) || stringValue(runInput.source_url);

  return (
    <section className="admin-resume-pipeline" aria-labelledby="editorial-completion-heading" data-testid="editorial-completion">
      <h2 id="editorial-completion-heading">Real-news editorial completion</h2>
      <dl className="admin-resume-state">
        <dt>Run status</dt><dd data-testid="completion-run-status">{run?.status ?? "No linked run"}</dd>
        <dt>Run ID</dt><dd><code>{run?.id ?? "—"}</code></dd>
        <dt>Editorial item ID</dt><dd><code>{item.id}</code></dd>
        <dt>Source ID</dt><dd><code>{item.source_id}</code></dd>
        <dt>WordPress draft</dt><dd data-testid="completion-wp-post-id">{wpPostId ? `Draft #${wpPostId}` : "Not created"}</dd>
      </dl>
      {sourceUrl ? <p>Original source: <a href={sourceUrl} target="_blank" rel="noopener noreferrer">{form.source_title || form.publisher || sourceUrl}</a></p> : null}
      {sourceText ? <details><summary>Preserved source text</summary><pre>{sourceText}</pre></details> : null}

      {held ? (
        <form onSubmit={(event) => { event.preventDefault(); void saveContent(); }}>
          <label>Thai article title
            <input required maxLength={500} value={form.title_th} onChange={(event) => update("title_th", event.target.value)} data-testid="completion-title" />
          </label>
          <label>Thai article body (minimum 200 characters)
            <textarea required minLength={200} rows={12} value={form.body_th} onChange={(event) => update("body_th", event.target.value)} data-testid="completion-body" />
          </label>
          <label>Excerpt
            <textarea maxLength={500} rows={3} value={form.excerpt_th} onChange={(event) => update("excerpt_th", event.target.value)} />
          </label>
          <label>Slug (lowercase letters, numbers, and dashes)
            <input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => update("slug", event.target.value)} />
          </label>
          <label>News type
            <select required value={form.news_type} onChange={(event) => update("news_type", event.target.value)}>
              <option value="">Select classification</option>
              {NEWS_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Original source URL (HTTPS)
            <input required type="url" pattern="https://.*" value={form.source_url} onChange={(event) => update("source_url", event.target.value)} />
          </label>
          <label>Original source headline
            <input required maxLength={500} value={form.source_title} onChange={(event) => update("source_title", event.target.value)} />
          </label>
          <label>Publisher / source attribution
            <input required maxLength={256} value={form.publisher} onChange={(event) => update("publisher", event.target.value)} />
          </label>
          <label>Source author (if available)
            <input maxLength={256} value={form.author} onChange={(event) => update("author", event.target.value)} />
          </label>
          <div className="admin-resume-actions">
            <button type="submit" className="admin-button" disabled={busy}>Save editorial content</button>
            <button type="button" className="admin-button" disabled={busy || !saved || !run} onClick={() => void requestResume()} data-testid="completion-resume">
              Save and request same-run resume
            </button>
          </div>
          <p className="admin-help">No test_content is used. Missing copy stays held. Resume continues the same run through FF90-02 checks, then the configured no-image text-only path, draft creation, and pending human review.</p>
        </form>
      ) : <p className="admin-help">Content editing is limited to runs currently held for content. This run cannot be changed from this panel.</p>}

      {recoveryId ? <p>Recovery request: <code>{recoveryId}</code> <button type="button" className="admin-button" disabled={busy} onClick={() => void dispatch(recoveryId)}>Retry dispatch</button></p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert" className="admin-error">{error}</p> : null}
      <p className="admin-help">This workflow creates only a WordPress draft and leaves review pending. It never approves or publishes.</p>
    </section>
  );
}
