// Football Factory — Admin Automation view-model (Set #3 Wave C).
//
// Read-only, advisory view-model that normalizes raw automation
// runs into UI-shaped data for the existing Admin V6 shell.
//
// Production invariants:
//   - mutationCapabilities() returns ALL FALSE (no UI button can
//     trigger a mutation through this view-model).
//   - retryUiContract().enabled is always FALSE (visibility only).
//   - View-model never mutates its inputs (deep copy via spread).
//   - Pure functions only — no I/O, no env reads, no network.
//   - Stages come from a single whitelist (STAGES) mirroring
//     production's stage-machine terminal + active states.

export const STAGES = [
  "ingested",
  "editorial_created",
  "ai_assist",
  "fact_check",
  "rights_check",
  "seo_check",
  "draft_created",
  "waiting_approval",
  "approved",
  "published",
  "rejected",
  "failed",
] as const;
export type AutomationStage = (typeof STAGES)[number];

export type RetryVisibility =
  | "NOT_ELIGIBLE"
  | "ELIGIBLE"
  | "ELIGIBLE_TRANSIENT";

export interface RawRun {
  runId?: string;
  editorialId?: string;
  stage?: string;
  status?: string;
  factStatus?: string;
  rightsStatus?: string;
  seoStatus?: string;
  approvalStatus?: string;
  title?: string;
  lastError?: string;
  wpPostId?: number | string | null;
  startedAt?: string;
  finishedAt?: string;
  retryEligible?: boolean;
  failureType?: string;
  timeline?: Array<{
    stage: string;
    at?: string;
    status?: string;
    message?: string;
  }>;
}

export interface NormalizedRun extends RawRun {
  durationMs: number | null;
  retryVisibility: RetryVisibility;
}

export interface TimelineEntry {
  stage: AutomationStage | string;
  status: string;
  at: string | null;
  message: string | null;
}

export interface HealthSummary {
  total: number;
  running: number;
  failed: number;
  waitingApproval: number;
  published: number;
  database: string;
  wordpress: string;
}

export type ViewStateKind =
  | "loading"
  | "error"
  | "degraded"
  | "empty"
  | "ready";

export type DegradedCode =
  | "database_not_configured"
  | "wordpress_unreachable";

export interface ViewState {
  kind: ViewStateKind;
  message?: string;
  code?: DegradedCode;
  count?: number;
}

export interface RetryUiContract {
  visible: boolean;
  enabled: boolean;
  label: string;
  reason: string | null;
}

export interface MutationCapabilities {
  canRetry: boolean;
  canApprove: boolean;
  canReject: boolean;
  canPublish: boolean;
  canMutateRun: boolean;
}

export interface SystemHealth {
  database?: string;
  wordpress?: string;
}

export interface FilterCriteria {
  search?: string;
  stage?: string;
  status?: string;
  factStatus?: string;
  rightsStatus?: string;
  seoStatus?: string;
  approvalStatus?: string;
}

// ----- Pure helpers ----------------------------------------------------

function computeDurationMs(
  startedAt: string | undefined,
  finishedAt: string | undefined,
): number | null {
  if (!startedAt || !finishedAt) return null;
  const s = new Date(startedAt).getTime();
  const f = new Date(finishedAt).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(f)) return null;
  return f - s;
}

function computeRetryVisibility(run: RawRun): RetryVisibility {
  if (run.retryEligible !== true) return "NOT_ELIGIBLE";
  if (run.failureType === "transient") return "ELIGIBLE_TRANSIENT";
  return "ELIGIBLE";
}

// ----- Stage timeline --------------------------------------------------

export function stageTimeline(run: RawRun): TimelineEntry[] {
  const events = Array.isArray(run.timeline) ? [...run.timeline] : [];
  events.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  return STAGES.map((stage) => {
    const e = events.find((x) => x.stage === stage);
    return {
      stage,
      status: e?.status ?? (stage === run.stage ? "current" : "pending"),
      at: e?.at ?? null,
      message: e?.message ?? null,
    };
  });
}

// ----- Run normalization -----------------------------------------------

export function normalizeRun(run: RawRun): NormalizedRun {
  return {
    ...run,
    durationMs: computeDurationMs(run.startedAt, run.finishedAt),
    retryVisibility: computeRetryVisibility(run),
  };
}

// ----- Filtering -------------------------------------------------------

export function filterRuns(
  runs: readonly RawRun[],
  filters: FilterCriteria = {},
): NormalizedRun[] {
  const q = String(filters.search ?? "").toLowerCase();
  return runs
    .map((r) => normalizeRun(r))
    .filter(
      (r) =>
        (!filters.stage || r.stage === filters.stage) &&
        (!filters.status || r.status === filters.status) &&
        (!filters.factStatus || r.factStatus === filters.factStatus) &&
        (!filters.rightsStatus || r.rightsStatus === filters.rightsStatus) &&
        (!filters.seoStatus || r.seoStatus === filters.seoStatus) &&
        (!filters.approvalStatus ||
          r.approvalStatus === filters.approvalStatus) &&
        (!q ||
          [r.runId, r.editorialId, r.title, r.lastError, r.wpPostId]
            .filter((x) => x !== undefined && x !== null)
            .some((x) => String(x).toLowerCase().includes(q))),
    );
}

// ----- Health summary --------------------------------------------------

export function healthSummary(
  runs: readonly RawRun[],
  system: SystemHealth = {},
): HealthSummary {
  const n = runs.map(normalizeRun);
  return {
    total: n.length,
    running: n.filter((x) => x.status === "running").length,
    failed: n.filter((x) => x.status === "failed").length,
    waitingApproval: n.filter((x) => x.stage === "waiting_approval").length,
    published: n.filter((x) => x.stage === "published").length,
    database: system.database ?? "ok",
    wordpress: system.wordpress ?? "ok",
  };
}

// ----- View state ------------------------------------------------------

export function viewState(
  runs: readonly RawRun[],
  opts: { loading?: boolean; error?: string | null; system?: SystemHealth } = {},
): ViewState {
  const loading = opts.loading ?? false;
  const error = opts.error ?? null;
  const system = opts.system ?? {};
  if (loading) return { kind: "loading" };
  if (error) return { kind: "error", message: String(error) };
  if (system.database === "database_not_configured") {
    return { kind: "degraded", code: "database_not_configured" };
  }
  if (system.wordpress === "wordpress_unreachable") {
    return { kind: "degraded", code: "wordpress_unreachable" };
  }
  if (!runs.length) return { kind: "empty" };
  return { kind: "ready", count: runs.length };
}

// ----- Retry UI contract ----------------------------------------------

export function retryUiContract(run: RawRun): RetryUiContract {
  const n = normalizeRun(run);
  return {
    visible: true,
    enabled: false, // ALWAYS false — visibility only, never a mutation trigger.
    label:
      n.retryVisibility === "ELIGIBLE_TRANSIENT"
        ? "Retry eligible (read-only)"
        : "Retry unavailable",
    reason: run.lastError ?? null,
  };
}

// ----- Mutation capabilities (always all-false) ------------------------

export function mutationCapabilities(): MutationCapabilities {
  return {
    canRetry: false,
    canApprove: false,
    canReject: false,
    canPublish: false,
    canMutateRun: false,
  };
}

// ----- Re-export the canonical stage list for consumers ----------------

export const ALL_STAGES = STAGES;