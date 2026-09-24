// Football Factory — editorial stage machine (PRE-N8N BACKEND).
//
// The `editorial_items.stage` column is free-form text (no DB CHECK),
// so any value can be persisted in principle. This module defines
// the canonical progression the automation routes are expected to
// follow and provides a validator.
//
// FF90 automation path:
//   ingested → editorial_created → ai_assist → seo_check → fact_check
//           → rights_check → draft_created → waiting_approval → approved
//           → published
//
// The admin editor path runs fact-check and rights-check before SEO. The
// explicit transition graph below supports both paths without permitting
// arbitrary stage skips.
//
// Terminal:
//   failed    — error path
//   rejected  — admin rejection
//
// Forward-only along the canonical path.
// Repeat of the same stage is allowed (idempotency).
// `rejected` and `failed` are terminal — no forward exit.

export const EDITORIAL_STAGES = [
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

export type EditorialStage = (typeof EDITORIAL_STAGES)[number];

// Linear (forward) index for each stage. Same stage → 0.
const FORWARD_ORDER: Record<EditorialStage, number> = {
  ingested: 0,
  editorial_created: 1,
  ai_assist: 2,
  fact_check: 3,
  rights_check: 4,
  seo_check: 5,
  draft_created: 6,
  waiting_approval: 7,
  approved: 8,
  published: 9,
  rejected: 10,
  failed: 11,
};

const TERMINAL: ReadonlySet<EditorialStage> = new Set([
  "rejected",
  "failed",
  "published", // also terminal from a forward-pipeline standpoint
]);

export function isEditorialStage(value: string): value is EditorialStage {
  return (EDITORIAL_STAGES as readonly string[]).includes(value);
}

/**
 * Returns the index of a stage along the forward canonical path.
 * Returns null for unknown stages.
 */
export function stageIndex(stage: string): number | null {
  if (!isEditorialStage(stage)) return null;
  return FORWARD_ORDER[stage];
}

// Forward adjacency graph: each stage lists its allowed next stages.
// Workflow branches are explicit; EditorialRepository separately requires
// SEO, fact-check, and rights metadata before entering draft_created.
const NEXT_FORWARD: Partial<Record<EditorialStage, readonly EditorialStage[]>> = {
  ingested: ["editorial_created"],
  editorial_created: ["ai_assist"],
  // FF90 runs SEO before fact-check; the admin editor runs fact-check first.
  ai_assist: ["seo_check", "fact_check"],
  seo_check: ["fact_check", "draft_created"],
  fact_check: ["rights_check"],
  // FF90 has already completed SEO when it reaches rights-check; the admin
  // editor performs SEO after rights-check.
  rights_check: ["seo_check", "draft_created"],
  draft_created: ["waiting_approval"],
  waiting_approval: ["approved"],
  approved: ["published"],
};

/**
 * Validate a forward transition. Same-stage is allowed (idempotency).
 * Backward transitions are rejected unless `from` is `rejected`/`failed`
 * (terminal — no exit). `to=rejected`/`failed` is allowed from any
 * non-terminal stage (admin/automation error path).
 *
 * Forward transitions are STRICTLY ADJACENT — skipping stages is
 * rejected. The only valid forward edge is the one named by
 * `NEXT_FORWARD[from]`.
 */
export function canTransition(from: string, to: string): boolean {
  if (!isEditorialStage(from) || !isEditorialStage(to)) return false;
  if (from === to) return true; // idempotent repeat
  if (TERMINAL.has(from)) return false; // no exit from terminal
  if (from === "published") return false; // published is also terminal
  // permitted transitions: any non-terminal can go to rejected|failed
  if (to === "rejected" || to === "failed") return true;
  // forward: must be the single adjacent next stage
  return NEXT_FORWARD[from]?.includes(to) ?? false;
}

/**
 * Strict validation for use inside repository or route layers.
 * Throws a `StageTransitionError` for invalid transitions.
 */
export class StageTransitionError extends Error {
  readonly code: "invalid_stage" | "invalid_stage_transition" | "terminal_state";
  readonly from: string;
  readonly to: string;
  constructor(
    code: "invalid_stage" | "invalid_stage_transition" | "terminal_state",
    from: string,
    to: string,
    message?: string,
  ) {
    super(message ?? `Invalid stage transition: ${from} → ${to}`);
    this.code = code;
    this.from = from;
    this.to = to;
    this.name = "StageTransitionError";
  }
}

export function assertTransition(from: string, to: string): void {
  if (!isEditorialStage(to)) {
    throw new StageTransitionError("invalid_stage", from, to, `Unknown stage: ${to}`);
  }
  if (!isEditorialStage(from)) {
    // Treat unknown starting stage as "ingested" (we accept this
    // because the column default is `ingested`). If the row was
    // hand-edited to a non-canonical stage, we accept any forward
    // move. This keeps the migration non-destructive.
    return;
  }
  if (TERMINAL.has(from) || from === "published") {
    throw new StageTransitionError(
      "terminal_state",
      from,
      to,
      `Stage ${from} is terminal; cannot transition to ${to}`,
    );
  }
  if (!canTransition(from, to)) {
    throw new StageTransitionError(
      "invalid_stage_transition",
      from,
      to,
      `Cannot transition ${from} → ${to}`,
    );
  }
}
