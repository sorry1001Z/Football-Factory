// Football Factory — wp-publish audit envelope.
//
// This module owns the audit-logging policy for the wp-publish route:
//
//   1. PRE-MUTATION: insert a "wp_publish_attempt" event BEFORE any
//      WordPress call. If the insert fails, the route MUST refuse to
//      proceed — return 503 audit_log_unavailable. This guarantees we
//      never silently publish without an audit trail.
//
//   2. POST-MUTATION: after WordPress responds, attempt to insert
//      "wp_publish_succeeded" OR "wp_publish_failed". If this insert
//      fails, we DO NOT roll back the WordPress mutation (it already
//      happened) — we surface an `audit_log_degraded: true` flag in
//      the response so callers can react. WordPress and DB states are
//      preserved as-is.
//
// We never log:
//   - AUTOMATION_SECRET
//   - Authorization header
//   - WordPress application password
//   - DATABASE_URL
//   - full request headers

import "server-only";

export type WpPublishAttemptMetadata = {
  editorial_item_id: string | null;
  wp_post_id: number | null;
  request_wp_post_id: number | null;
  request_id: string | null;
  ip_hash: string | null;
};

export type WpPublishResultMetadata = WpPublishAttemptMetadata & {
  wp_status?: string;
  failure_kind?: string;
  failure_http?: number | null;
};

export type AuditResult = { ok: true; id: number } | { ok: false };

/**
 * Structural minimum for the repository. We accept any object with an
 * `insert(entry)` method to keep tests free of the concrete
 * AutomationLogRepository constructor. Production code passes a real
 * AutomationLogRepository.
 */
export type InsertableLogRepo = {
  insert(entry: {
    run_id: string | null;
    action: string;
    stage: string;
    status: string;
    message: string | null;
    metadata: unknown;
    request_id: string | null;
    ip_hash: string | null;
  }): Promise<{ id: number }>;
};

/**
 * Insert the pre-mutation attempt event. Throws nothing — returns a
 * discriminated result so the caller can 503 cleanly.
 */
export async function recordWpPublishAttempt(
  repo: InsertableLogRepo,
  meta: WpPublishAttemptMetadata,
): Promise<AuditResult> {
  try {
    const r = await repo.insert({
      run_id: null, // route fills from caller
      action: "wp_publish_attempt",
      stage: "publish_attempt",
      status: "running",
      message: "Pre-mutation audit log for wp-publish",
      metadata: meta,
      request_id: meta.request_id,
      ip_hash: meta.ip_hash,
    });
    return { ok: true, id: r.id };
  } catch {
    return { ok: false };
  }
}

/**
 * Insert a post-mutation outcome event. Throws nothing — caller is
 * responsible for surfacing `audit_log_degraded` to the response when
 * `ok === false`.
 */
export async function recordWpPublishResult(
  repo: InsertableLogRepo,
  meta: WpPublishResultMetadata,
  succeeded: boolean,
): Promise<AuditResult> {
  try {
    const action = succeeded ? "wp_publish_succeeded" : "wp_publish_failed";
    const status = succeeded ? "success" : "failed";
    const r = await repo.insert({
      run_id: null,
      action,
      stage: succeeded ? "published" : "publish_failed",
      status,
      message: succeeded ? "WP status updated to publish" : "WP publish call did not succeed",
      metadata: meta,
      request_id: meta.request_id,
      ip_hash: meta.ip_hash,
    });
    return { ok: true, id: r.id };
  } catch {
    return { ok: false };
  }
}
