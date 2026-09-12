"use client";

// Football Factory — Admin detail client component (R2 Wave 2C).
//
// Combines:
//   - Editorial item header (title, source, stage, approval, rights,
//     fact, SEO status)
//   - Review panels (rights / fact / approval / retry)
//   - Audit timeline

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminTimeline } from "./timeline";
import type { EditorialItem } from "@/lib/auth/editorial-repository";

export function AdminDetail({ item }: { item: EditorialItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const meta =
    typeof item.metadata === "object" && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : {};
  const title =
    typeof meta.title === "string" ? meta.title : item.source_id;
  const sourceUrl =
    typeof meta.source_url === "string" ? meta.source_url : "";
  const sourceName =
    typeof meta.source_name === "string" ? meta.source_name : "";
  const rights = (meta.rights ?? {}) as Record<string, unknown>;
  const fact = (meta.fact ?? {}) as Record<string, unknown>;
  const seo = (meta.seo ?? {}) as Record<string, unknown>;
  const rightsState = rights.state ? String(rights.state) : "missing";
  const factState = fact.state ? String(fact.state) : "missing";
  const seoState = seo.state ? String(seo.state) : "missing";

  const [rightsSourceUrl, setRightsSourceUrl] = useState("");
  const [rightsLicenseName, setRightsLicenseName] = useState("");
  const [rightsCommercial, setRightsCommercial] = useState(false);
  const [rightsDecision, setRightsDecision] = useState<
    "cleared" | "rejected" | "manual_review"
  >("manual_review");
  const [rightsNotes, setRightsNotes] = useState("");

  const [factSummary, setFactSummary] = useState("");
  const [factSources, setFactSources] = useState<string[]>([]);
  const [factDecision, setFactDecision] = useState<
    "cleared" | "flagged" | "rejected"
  >("flagged");

  const [approvalDecision, setApprovalDecision] = useState<
    "approved" | "rejected"
  >("approved");
  const [approvalNote, setApprovalNote] = useState("");

  const [retryReason, setRetryReason] = useState("");
  const [retryErrorClass, setRetryErrorClass] = useState("unknown");
  const [retryResponse, setRetryResponse] = useState<string | null>(null);

  const fetchCsrf = useCallback(async (): Promise<string | null> => {
    // Pull a CSRF token from the form. The route expects either an
    // x-csrf-token header OR a same-origin POST without the header
    // (the csrf helper decides). We rely on the csrf helper inside
    // the route; we don't need to send a token explicitly here.
    return null;
  }, []);

  const reload = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router, startTransition]);

  const postJson = useCallback(
    async (
      path: string,
      body: Record<string, unknown>,
    ): Promise<{ ok: boolean; status: number; text: string }> => {
      await fetchCsrf();
      const r = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    },
    [fetchCsrf],
  );

  async function submitRights() {
    setServerError(null);
    const evidence =
      rightsDecision === "cleared"
        ? {
            source_url: rightsSourceUrl,
            license_name: rightsLicenseName,
            commercial_use_confirmed: true as const,
            notes: rightsNotes || undefined,
          }
        : undefined;
    const r = await postJson(
      `/api/admin/editorial/${item.id}/rights-review`,
      {
        decision: rightsDecision,
        evidence,
        notes: rightsNotes || undefined,
      },
    );
    if (!r.ok) {
      setServerError(`rights_review http_${r.status}: ${r.text}`);
      return;
    }
    reload();
  }

  async function submitFact() {
    setServerError(null);
    const evidence =
      factDecision === "cleared"
        ? {
            claim_check_summary: factSummary,
            claim_sources: factSources.filter(Boolean),
          }
        : undefined;
    const r = await postJson(
      `/api/admin/editorial/${item.id}/fact-review`,
      {
        decision: factDecision,
        evidence,
        notes: undefined,
      },
    );
    if (!r.ok) {
      setServerError(`fact_review http_${r.status}: ${r.text}`);
      return;
    }
    reload();
  }

  async function submitApproval() {
    setServerError(null);
    const r = await postJson(
      `/api/admin/editorial/${item.id}/approval`,
      {
        state: approvalDecision,
        note: approvalNote || undefined,
      },
    );
    if (!r.ok) {
      setServerError(`approval http_${r.status}: ${r.text}`);
      return;
    }
    reload();
  }

  async function submitRetry() {
    setServerError(null);
    setRetryResponse(null);
    const r = await postJson(
      `/api/admin/editorial/${item.id}/retry`,
      {
        reason: retryReason,
        errorClass: retryErrorClass,
      },
    );
    setRetryResponse(`http_${r.status}: ${r.text}`);
    if (r.ok) {
      reload();
    }
  }

  const canApprove =
    item.rights_confirmed &&
    (factState === "cleared" || factState === "missing") &&
    item.approval_state === "pending";

  return (
    <div className="admin-shell admin-detail">
      <header className="admin-detail-header">
        <h1>{title}</h1>
        <dl>
          <dt>Editorial ID</dt>
          <dd><code>{item.id}</code></dd>
          <dt>Source</dt>
          <dd>{item.source_id}</dd>
          {sourceUrl ? (
            <>
              <dt>Source URL</dt>
              <dd><a href={sourceUrl} rel="noopener noreferrer">{sourceUrl}</a></dd>
            </>
          ) : null}
          {sourceName ? (
            <>
              <dt>Source name</dt>
              <dd>{sourceName}</dd>
            </>
          ) : null}
          <dt>Stage</dt>
          <dd>
            <span className={`admin-badge stage-${item.stage}`}>{item.stage}</span>
          </dd>
          <dt>Approval</dt>
          <dd>
            <span className={`admin-badge approval-${item.approval_state}`}>
              {item.approval_state}
            </span>
          </dd>
          <dt>Rights</dt>
          <dd>
            <span
              className={`admin-badge rights-${rightsState}${item.rights_confirmed ? " confirmed" : ""}`}
            >
              {rightsState}
              {item.rights_confirmed ? " ✓" : ""}
            </span>
          </dd>
          <dt>Fact</dt>
          <dd>
            <span className={`admin-badge fact-${factState}`}>{factState}</span>
          </dd>
          <dt>SEO</dt>
          <dd>
            <span className={`admin-badge seo-${seoState}`}>{seoState}</span>
          </dd>
          <dt>WP Post ID</dt>
          <dd>{item.wp_post_id ?? "—"}</dd>
          <dt>Approved by</dt>
          <dd>{item.approved_by ?? "—"}</dd>
          <dt>Approved at</dt>
          <dd>{item.approved_at ?? "—"}</dd>
        </dl>
      </header>

      {serverError ? (
        <p role="alert" className="admin-error">{serverError}</p>
      ) : null}

      <section aria-labelledby="rights-review-heading">
        <h2 id="rights-review-heading">Rights review</h2>
        <p>
          The human must explicitly confirm commercial use. Registry
          does NOT auto-fill truthy confirmation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitRights();
          }}
        >
          <label>
            Decision
            <select
              value={rightsDecision}
              onChange={(e) =>
                setRightsDecision(
                  e.target.value as "cleared" | "rejected" | "manual_review",
                )
              }
            >
              <option value="manual_review">manual_review</option>
              <option value="cleared">cleared</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          {rightsDecision === "cleared" ? (
            <>
              <label>
                Source URL
                <input
                  type="url"
                  required
                  value={rightsSourceUrl}
                  onChange={(e) => setRightsSourceUrl(e.target.value)}
                />
              </label>
              <label>
                License name
                <input
                  type="text"
                  required
                  minLength={1}
                  maxLength={256}
                  value={rightsLicenseName}
                  onChange={(e) => setRightsLicenseName(e.target.value)}
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={rightsCommercial}
                  onChange={(e) => setRightsCommercial(e.target.checked)}
                />
                Commercial use confirmed
              </label>
            </>
          ) : null}
          <label>
            Notes
            <textarea
              maxLength={2048}
              value={rightsNotes}
              onChange={(e) => setRightsNotes(e.target.value)}
            />
          </label>
          <button type="submit" className="admin-button" disabled={pending}>
            Submit rights review
          </button>
        </form>
      </section>

      <section aria-labelledby="fact-review-heading">
        <h2 id="fact-review-heading">Fact review</h2>
        <p>fact_check_score is NEVER fabricated. Server stores null.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitFact();
          }}
        >
          <label>
            Decision
            <select
              value={factDecision}
              onChange={(e) =>
                setFactDecision(
                  e.target.value as "cleared" | "flagged" | "rejected",
                )
              }
            >
              <option value="flagged">flagged</option>
              <option value="cleared">cleared</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          {factDecision === "cleared" ? (
            <>
              <label>
                Claim check summary (8–4096 chars)
                <textarea
                  required
                  minLength={8}
                  maxLength={4096}
                  value={factSummary}
                  onChange={(e) => setFactSummary(e.target.value)}
                />
              </label>
              <label>
                Claim sources (one URL per line, 1–50)
                <textarea
                  required
                  placeholder={"https://example.com/source1\nhttps://example.com/source2"}
                  value={factSources.join("\n")}
                  onChange={(e) =>
                    setFactSources(
                      e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
                    )
                  }
                />
              </label>
            </>
          ) : null}
          <button type="submit" className="admin-button" disabled={pending}>
            Submit fact review
          </button>
        </form>
      </section>

      <section aria-labelledby="approval-heading">
        <h2 id="approval-heading">Approval</h2>
        <p>
          UI disables <em>Approve</em> until rights are confirmed and
          fact is cleared/missing. Backend remains source of truth.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitApproval();
          }}
        >
          <label>
            Decision
            <select
              value={approvalDecision}
              onChange={(e) =>
                setApprovalDecision(e.target.value as "approved" | "rejected")
              }
            >
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label>
            Note
            <textarea
              maxLength={1000}
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="admin-button"
            disabled={pending || (approvalDecision === "approved" && !canApprove)}
          >
            Submit approval
          </button>
          {approvalDecision === "approved" && !canApprove ? (
            <p className="admin-warning">
              Cannot approve until rights_confirmed=true AND fact state
              is cleared or missing.
            </p>
          ) : null}
        </form>
      </section>

      <section aria-labelledby="retry-heading">
        <h2 id="retry-heading">Retry (transient only)</h2>
        <p>
          Retry is gated by <code>canRetry()</code> in
          <code> lib/automation/retry-policy.ts</code>. Permanent
          failures (auth/validation/rights_rejected/approval_rejected/
          association_mismatch/ownership_mismatch) cannot retry. Terminal
          stages (rejected/failed/published) cannot retry. waiting_approval
          and approved need human action, not retry.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitRetry();
          }}
        >
          <label>
            Reason
            <input
              type="text"
              required
              minLength={1}
              maxLength={500}
              value={retryReason}
              onChange={(e) => setRetryReason(e.target.value)}
            />
          </label>
          <label>
            Error class
            <select
              value={retryErrorClass}
              onChange={(e) => setRetryErrorClass(e.target.value)}
            >
              <option value="unknown">unknown</option>
              <option value="timeout">timeout</option>
              <option value="network">network</option>
              <option value="upstream_temporary">upstream_temporary</option>
              <option value="wp_retryable">wp_retryable</option>
              <option value="auth">auth (permanent)</option>
              <option value="validation">validation (permanent)</option>
              <option value="rights_rejected">rights_rejected (permanent)</option>
              <option value="approval_rejected">approval_rejected (permanent)</option>
              <option value="association_mismatch">association_mismatch (permanent)</option>
              <option value="ownership_mismatch">ownership_mismatch (permanent)</option>
            </select>
          </label>
          <button type="submit" className="admin-button" disabled={pending}>
            Submit retry
          </button>
          {retryResponse ? (
            <pre className="admin-retry-response">{retryResponse}</pre>
          ) : null}
        </form>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">Audit timeline</h2>
        <AdminTimeline editorialItemId={item.id} />
      </section>
    </div>
  );
}
