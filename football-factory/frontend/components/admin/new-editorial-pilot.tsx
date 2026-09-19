"use client";

// Football Factory — minimal "New Editorial Pilot" UI.
//
// Drives the admin pipeline end-to-end through POSTs to:
//   /api/admin/editorial/deduplicate
//   /api/admin/editorial/create
//   /api/admin/editorial/[id]/ai-assist
//   /api/admin/editorial/[id]/fact-check
//   /api/admin/editorial/[id]/rights-check
//   /api/admin/editorial/[id]/seo-check
//   /api/admin/editorial/[id]/wp-draft
//
// Human approval stays manual — there is no publish button. Once the
// draft is created the operator reviews the WP draft in WordPress admin
// or in the editorial detail page (/admin/editorial/[id]) and decides
// CONTENT_APPROVED + RIGHTS_APPROVED there.

import { useState } from "react";

type Step = "source" | "create" | "ai" | "fact" | "rights" | "seo" | "wp";

type Props = {
  /** Operator must be logged in (admin or editor) before navigating here. */
  adminLogoutHref?: string;
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

type CreateResp = {
  ok: true;
  editorial_item_id: string;
  run_id: string;
  stage: string;
  approval_state: string;
};

type WpResp = {
  ok: true;
  run_id: string;
  wp_post_id: number;
  status: string;
  idempotent?: boolean;
};

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const j = (await r.json()) as T & { ok?: boolean; error?: string };
    if (!r.ok || (j as { ok?: boolean }).ok === false) {
      throw new Error((j as { error?: string }).error ?? `HTTP ${r.status}`);
    }
    return j;
  });
}

export default function NewEditorialPilot(_props: Props) {
  const [step, setStep] = useState<Step>("source");

  // Source
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePubTime, setSourcePubTime] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [teamCompetition, setTeamCompetition] = useState("");

  // Run / item
  const [runId, setRunId] = useState<string | null>(null);
  const [editorialItemId, setEditorialItemId] = useState<string | null>(null);

  // AI / draft
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftExcerpt, setDraftExcerpt] = useState("");
  const [draftBody, setDraftBody] = useState("");

  // Fact-check verdict
  const [factState, setFactState] = useState<"pending_manual" | "flagged" | "rejected">(
    "pending_manual",
  );

  // Rights
  const [rightsState, setRightsState] = useState<"pending" | "manual_review" | "rejected">(
    "manual_review",
  );

  // WP draft
  const [wpPostId, setWpPostId] = useState<number | null>(null);

  // Status
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function appendLog(s: string) {
    setLog((prev) => [...prev, `${new Date().toISOString()}  ${s}`]);
  }

  async function handleDedupe() {
    if (!sourceUrl.trim() || !sourcePubTime.trim()) {
      setError("source_url and publication_time are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Deterministic source_id from sha256(url + "|" + pubTime).
      const sourceId = await sha256Hex(`${sourceUrl.trim()}|${sourcePubTime.trim()}`);
      appendLog(`source_id computed = src:${sourceId.slice(0, 24)}`);

      const r = await postJson<DedupeResp>("/api/admin/editorial/deduplicate", {
        source_id: sourceId,
        title: sourceTitle,
        url: sourceUrl,
      });
      setRunId(r.run_id);
      if (r.duplicate) {
        setEditorialItemId(r.editorial_item_id);
        appendLog(
          `DEDUPE: duplicate found (existing editorial_item_id=${r.editorial_item_id}, stage=${r.existing_stage})`,
        );
        // Cannot create a new item — operator must pick a different story.
        setError(
          `Duplicate source. Existing editorial_item_id=${r.editorial_item_id}. Stop and pick another story.`,
        );
        return;
      }
      appendLog(`DEDUPE: passed, fresh run_id=${r.run_id}`);
      setStep("create");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!runId) {
      setError("internal: run_id missing");
      return;
    }
    if (!sourceTitle.trim()) {
      setError("title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sourceId = await sha256Hex(`${sourceUrl.trim()}|${sourcePubTime.trim()}`);
      const r = await postJson<CreateResp>("/api/admin/editorial/create", {
        run_id: runId,
        source_id: sourceId,
        title: sourceTitle,
        source_url: sourceUrl,
        source_name: sourceName,
        metadata: {
          competition: teamCompetition,
          language: "th",
          source_publication_time: sourcePubTime,
        },
      });
      setEditorialItemId(r.editorial_item_id);
      appendLog(
        `CREATE: editorial_item_id=${r.editorial_item_id} stage=${r.stage} approval=${r.approval_state}`,
      );
      setStep("ai");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAi() {
    if (!runId || !editorialItemId) {
      setError("internal: missing run_id or editorial_item_id");
      return;
    }
    if (!draftBody.trim()) {
      setError("draft body is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/editorial/${editorialItemId}/ai-assist`, {
        run_id: runId,
        content: draftBody,
      });
      appendLog(`AI: stage=ai_assist content_hash recorded`);
      setStep("fact");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFact() {
    if (!runId || !editorialItemId) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/editorial/${editorialItemId}/fact-check`, {
        run_id: runId,
        content: draftBody,
        state: factState,
      });
      appendLog(`FACT: state=${factState}`);
      setStep("rights");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRights() {
    if (!runId || !editorialItemId) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/editorial/${editorialItemId}/rights-check`, {
        run_id: runId,
        state: rightsState,
        source_url: sourceUrl,
        source_name: sourceName,
      });
      appendLog(`RIGHTS: state=${rightsState} (cleared would require provider; not auto-cleared)`);
      setStep("seo");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSeo() {
    if (!runId || !editorialItemId) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/admin/editorial/${editorialItemId}/seo-check`, {
        run_id: runId,
        title: draftTitle,
        content: draftBody,
        slug: draftSlug || undefined,
        description: draftExcerpt || undefined,
      });
      appendLog(`SEO: score computed (no keyword stuffing; no misleading title)`);
      setStep("wp");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleWpDraft() {
    if (!runId || !editorialItemId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<WpResp>(
        `/api/admin/editorial/${editorialItemId}/wp-draft`,
        {
          run_id: runId,
          title: draftTitle || sourceTitle,
          content: draftBody,
        },
      );
      setWpPostId(r.wp_post_id);
      appendLog(
        `WP DRAFT: created wp_post_id=${r.wp_post_id} status=${r.status} idempotent=${!!r.idempotent}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy;

  return (
    <div className="admin-pilot" data-testid="admin-new-pilot">
      <h1>New Editorial Pilot</h1>
      <p className="admin-help">
        Operator-driven end-to-end editorial pipeline. Each step calls one
        admin-authenticated route. No AUTOMATION_SECRET required.
        AUTOMATION_ENABLED remains MISSING.
      </p>

      {error && (
        <div className="admin-error" role="alert" data-testid="admin-pilot-error">
          {error}
        </div>
      )}

      <ol className="admin-steps">
        <li className={step === "source" ? "active" : "done"}>
          <strong>Step 1 — Source</strong>
          <fieldset disabled={busy || step !== "source"}>
            <label>
              Source title (factual, no clickbait)
              <input
                type="text"
                required
                maxLength={500}
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
              />
            </label>
            <label>
              Source URL (operator MUST verify the article exists)
              <input
                type="url"
                required
                maxLength={2048}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>
            <label>
              Publication time (ISO 8601 UTC, read from article header)
              <input
                type="text"
                required
                placeholder="2026-XX-XXTXX:XX:XXZ"
                value={sourcePubTime}
                onChange={(e) => setSourcePubTime(e.target.value)}
              />
            </label>
            <label>
              Publisher / source name
              <input
                type="text"
                maxLength={256}
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </label>
            <label>
              Competition / team (optional metadata)
              <input
                type="text"
                maxLength={256}
                value={teamCompetition}
                onChange={(e) => setTeamCompetition(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleDedupe}
              data-testid="admin-pilot-dedupe"
            >
              Check Duplicate
            </button>
          </fieldset>
        </li>

        <li className={step === "create" ? "active" : step === "source" ? "pending" : "done"}>
          <strong>Step 2 — Create Editorial Item</strong>
          <fieldset disabled={busy || step !== "create"}>
            <p>
              Run ID: <code>{runId ?? "(none yet)"}</code>
            </p>
            <button
              type="button"
              disabled={!canSubmit || !runId}
              onClick={handleCreate}
              data-testid="admin-pilot-create"
            >
              Create Editorial Item
            </button>
          </fieldset>
        </li>

        <li className={step === "ai" ? "active" : "pending"}>
          <strong>Step 3 — Draft Body</strong>
          <fieldset disabled={busy || step !== "ai"}>
            <label>
              Article title (factual, no clickbait)
              <input
                type="text"
                maxLength={500}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </label>
            <label>
              Slug (lowercase, a-z 0-9 dashes, 3..64)
              <input
                type="text"
                maxLength={64}
                value={draftSlug}
                onChange={(e) => setDraftSlug(e.target.value)}
              />
            </label>
            <label>
              Excerpt (1-2 sentences, ≤500 chars)
              <textarea
                maxLength={500}
                value={draftExcerpt}
                onChange={(e) => setDraftExcerpt(e.target.value)}
              />
            </label>
            <label>
              Article body (Thai, ≥200 chars, no fabricated quotes/stats)
              <textarea
                required
                minLength={200}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={10}
              />
            </label>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleAi}
              data-testid="admin-pilot-ai"
            >
              Record AI Step
            </button>
          </fieldset>
        </li>

        <li className={step === "fact" ? "active" : "pending"}>
          <strong>Step 4 — Fact Check (operator verdict)</strong>
          <fieldset disabled={busy || step !== "fact"}>
            <label>
              Decision
              <select
                value={factState}
                onChange={(e) =>
                  setFactState(e.target.value as "pending_manual" | "flagged" | "rejected")
                }
              >
                <option value="pending_manual">pending_manual</option>
                <option value="flagged">flagged</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <p className="admin-help">
              Note: <code>cleared</code> is rejected unless a fact-check provider is
              configured (provider_status=not_configured today).
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleFact}
              data-testid="admin-pilot-fact"
            >
              Submit Fact Verdict
            </button>
          </fieldset>
        </li>

        <li className={step === "rights" ? "active" : "pending"}>
          <strong>Step 5 — Image Rights (operator verdict)</strong>
          <fieldset disabled={busy || step !== "rights"}>
            <label>
              Decision
              <select
                value={rightsState}
                onChange={(e) =>
                  setRightsState(e.target.value as "pending" | "manual_review" | "rejected")
                }
              >
                <option value="manual_review">manual_review (default)</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <p className="admin-help">
              Note: <code>cleared</code> is rejected unless a rights provider is
              configured. This endpoint NEVER auto-clears rights.
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleRights}
              data-testid="admin-pilot-rights"
            >
              Submit Rights Verdict
            </button>
          </fieldset>
        </li>

        <li className={step === "seo" ? "active" : "pending"}>
          <strong>Step 6 — SEO</strong>
          <fieldset disabled={busy || step !== "seo"}>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSeo}
              data-testid="admin-pilot-seo"
            >
              Run Local SEO Check
            </button>
          </fieldset>
        </li>

        <li className={step === "wp" ? "active" : "pending"}>
          <strong>Step 7 — Create WordPress DRAFT</strong>
          <fieldset disabled={busy || step !== "wp"}>
            <p>
              Editorial item ID: <code>{editorialItemId ?? "(none)"}</code>
            </p>
            <p>
              WP post ID (after creation): <code>{wpPostId ?? "(none yet)"}</code>
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleWpDraft}
              data-testid="admin-pilot-wp"
            >
              Create WP Draft
            </button>
            <p className="admin-help">
              Retry is idempotent — re-clicking the button returns the same
              <code> wp_post_id</code> and does NOT create a second draft.
            </p>
          </fieldset>
        </li>
      </ol>

      <section className="admin-pilot-log">
        <h2>Audit log (operator-visible)</h2>
        <pre data-testid="admin-pilot-log">{log.join("\n")}</pre>
      </section>
    </div>
  );
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
