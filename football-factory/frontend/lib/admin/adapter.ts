// Football Factory — Admin UI adapter (R2 Wave 2C).
//
// Translates raw backend payloads into UI-shaped objects. The
// adapter is the ONLY place where Pack 02-style enum names can
// appear (e.g. `'pass' | 'fail' | 'needs-more-evidence'`). All
// call sites use the canonical contracts from contracts.ts.
//
// NEVER throws on parse errors; returns a typed error envelope
// the UI can render instead.

import { redactSecrets } from "@/lib/auth/redact-secrets";
import type { AuditEvent, AutomationRunSummary } from "./contracts";
import type { EditorialItem } from "@/lib/auth/editorial-repository";

/**
 * Normalize a single audit_logs row from the DB into a UI-safe
 * AuditEvent. Redacts metadata recursively. Caps oversized payloads.
 */
export function normalizeAuditRow(row: {
  id: number | string;
  created_at: string;
  action: string;
  actor_user_id: string | null;
  metadata: unknown;
}): AuditEvent {
  const rawMeta =
    typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};
  // Redact recursively.
  const scrubbed = redactSecrets(rawMeta) as Record<string, unknown>;
  // Cap metadata payload size to keep responses small.
  const metadataSafe = capMetadata(scrubbed);
  return {
    id: typeof row.id === "string" ? Number(row.id) : row.id,
    at: row.created_at,
    action: String(row.action ?? "unknown"),
    actor: row.actor_user_id ?? null,
    summary: buildAuditSummary(row.action, scrubbed),
    metadataSafe,
  };
}

function capMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  // Trim deeply-nested objects to 16 keys. Drop values longer than 2KB.
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (count >= 16) break;
    if (typeof v === "string" && v.length > 2048) {
      out[k] = v.slice(0, 2048) + "…";
    } else if (v === null || typeof v !== "object") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 32);
    } else {
      out[k] = "[object]";
    }
    count++;
  }
  return out;
}

function buildAuditSummary(action: string, meta: Record<string, unknown>): string {
  if (action === "rights_review") {
    const decision = String(meta.decision ?? "unknown");
    const method = String(meta.method ?? "—");
    return `Rights review: ${decision} (${method})`;
  }
  if (action === "fact_review") {
    const decision = String(meta.decision ?? "unknown");
    return `Fact review: ${decision}`;
  }
  if (action === "approval_decision") {
    const state = String(meta.new_state ?? meta.state ?? "unknown");
    return `Approval: ${state}`;
  }
  if (action === "stage_advance") {
    const from = String(meta.from ?? "—");
    const to = String(meta.to ?? "—");
    return `Stage: ${from} → ${to}`;
  }
  if (action === "retry_request") {
    return `Retry requested: ${String(meta.reason ?? "")}`;
  }
  if (action === "retry_refused") {
    return `Retry refused: ${String(meta.reason ?? "")}`;
  }
  if (action === "dedupe" || action === "wp_draft" || action === "wp_publish") {
    return `Automation: ${action}`;
  }
  return action;
}

/**
 * Normalize a single automation_runs row into a UI-safe
 * AutomationRunSummary. The route layer is responsible for NOT
 * returning the secret / wordpress password / db url; the adapter
 * simply asserts the surface.
 */
export function normalizeRunRow(row: {
  id: string;
  workflow: string;
  status: string;
  stage: string | null;
  error_class: string | null;
  editorial_item_id: string | null;
  wp_post_id: number | null;
  created_at: string;
  updated_at: string;
}): AutomationRunSummary {
  return {
    id: String(row.id ?? ""),
    workflow: String(row.workflow ?? ""),
    status: String(row.status ?? "unknown"),
    stage: String(row.stage ?? "—"),
    errorClass: String(row.error_class ?? "unknown"),
    editorialItemId: row.editorial_item_id ?? null,
    wpPostId: row.wp_post_id ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * Map an editorial_item row to a UI-shaped summary with computed
 * rights / fact states read from metadata. Pure.
 */
export interface EditorialView {
  id: string;
  sourceId: string;
  wpPostId: number | null;
  stage: string;
  approvalState: string;
  rightsConfirmed: boolean;
  rightsState: string;
  factState: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toEditorialView(item: EditorialItem): EditorialView {
  const meta =
    typeof item.metadata === "object" && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : {};
  const rights = (meta.rights ?? {}) as Record<string, unknown>;
  const fact = (meta.fact ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    sourceId: item.source_id,
    wpPostId: item.wp_post_id,
    stage: item.stage,
    approvalState: item.approval_state,
    rightsConfirmed: item.rights_confirmed,
    rightsState: rights.state ? String(rights.state) : "missing",
    factState: fact.state ? String(fact.state) : "missing",
    title: typeof meta.title === "string" ? meta.title : item.source_id,
    sourceUrl: typeof meta.source_url === "string" ? meta.source_url : "",
    sourceName: typeof meta.source_name === "string" ? meta.source_name : "",
    approvedBy: item.approved_by,
    approvedAt: item.approved_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

/**
 * Build a search-keyword WHERE-clause fragment for SQL, given a
 * raw user input. The fragment is safe (parameterized) — only
 * placeholders ($1, $2, ...) appear in the returned string. The
 * caller is responsible for binding parameters in the same order.
 *
 * Returns:
 *   { clause: " AND (title ILIKE $1 OR source_id ILIKE $1)", params: ["%foo%"] }
 *
 * If `search` is empty, returns null. The fragment can be appended
 * directly into a query string with no further escaping needed.
 */
export function buildSearchFragment(search: string): {
  clause: string;
  params: string[];
} | null {
  const trimmed = search.trim();
  if (!trimmed) return null;
  // Escape SQL LIKE wildcards in the user input. We still bind the
  // value as a parameter; the only thing we need to escape is the
  // LIKE wildcards themselves (%, _, \) so the search behaves as
  // a substring search.
  const safe = trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return {
    clause: " AND (metadata->>'title' ILIKE $1 OR source_id ILIKE $1)",
    params: [`%${safe}%`],
  };
}
