// Football Factory — Admin UI contracts (R2 Wave 2C).
//
// Canonical types aligned with the live backend. Pack 02 names are
// translated through `lib/admin/adapter.ts` to match the production
// API shape exactly.

import type { ApprovalState, EditorialItem } from "@/lib/auth/editorial-repository";

// ----- Stage (canonical pipeline) ---------------------------------------

export type { EditorialStage } from "@/lib/auth/stage-machine";

// ----- Approval / Rights / Fact states ---------------------------------

export type RightsState =
  | "missing"
  | "pending"
  | "cleared"
  | "manual_review"
  | "rejected";

export type FactState = "missing" | "cleared" | "flagged" | "rejected";

export type SeoState = "missing" | "ok" | "warn" | "fail";

// ----- Sort whitelist --------------------------------------------------

export type EditorialSortKey =
  | "updated_at_desc"
  | "updated_at_asc"
  | "created_at_desc"
  | "created_at_asc";

export const SORT_KEYS: readonly EditorialSortKey[] = [
  "updated_at_desc",
  "updated_at_asc",
  "created_at_desc",
  "created_at_asc",
] as const;

// ----- Pagination ------------------------------------------------------

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

// ----- List / detail payloads ------------------------------------------

export interface EditorialListResponse {
  ok: true;
  items: EditorialItem[];
  total: number;
  page: number;
  pageSize: number;
  sort: EditorialSortKey;
  filters: {
    stage: string | null;
    approvalState: ApprovalState | null;
    rights: RightsState | null;
    fact: FactState | null;
    search: string | null;
  };
}

export interface AuditEvent {
  id: number;
  at: string;
  action: string;
  actor: string | null;
  summary: string;
  metadataSafe: Record<string, unknown>;
}

export interface AutomationRunSummary {
  id: string;
  workflow: string;
  status: string;
  stage: string;
  errorClass: string;
  editorialItemId: string | null;
  wpPostId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunResponse {
  ok: true;
  run: AutomationRunSummary;
  editorialItem: EditorialItem | null;
  recentEvents: AuditEvent[];
}

// ----- Review / retry responses ----------------------------------------

export interface FactReviewRequest {
  decision: "cleared" | "flagged" | "rejected";
  evidence?: {
    claim_check_summary: string;
    claim_sources: string[];
    notes?: string;
  };
  notes?: string;
}

export interface RightsReviewRequest {
  decision: "cleared" | "rejected" | "manual_review";
  evidence?: {
    source_url: string;
    license_name: string;
    commercial_use_confirmed: true;
    news_or_editorial_use_confirmed?: true;
    source_name?: string;
    author?: string;
    license_url?: string;
    attribution_text?: string;
    notes?: string;
  };
  notes?: string;
}

export interface ApprovalRequest {
  state: "approved" | "rejected";
  note?: string;
}

export interface RetryRequest {
  reason: string;
  // The error class is captured by the UI from the most recent
  // failed automation_logs record for this item / run. Defaults to
  // 'unknown' if not provided.
  errorClass?: string;
}

export interface RetryResponse {
  ok: true;
  ran: true | false;
  reason: string;
  nextAction: { kind: "noop" | "rerun_stage" | "advance_stage"; stage: string; runId: string } | null;
  run: AutomationRunSummary;
  editorialItem: EditorialItem;
}

// ----- Filters (URL query) ---------------------------------------------

export interface EditorialFilters {
  search: string;
  stage: string;
  approvalState: ApprovalState;
  rights: RightsState;
  fact: FactState;
}

export const EMPTY_FILTERS: EditorialFilters = {
  search: "",
  stage: "",
  approvalState: "pending",
  rights: "missing",
  fact: "missing",
};
