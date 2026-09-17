// Football Factory — wp-draft idempotency guard.
//
// Problem: wp-draft is invoked by the n8n pipeline. A network blip or
// temporary n8n hiccup could cause a retry that creates a duplicate
// draft in WordPress. This module is the dedup seam.
//
// Decision rule (fail-closed):
//   1. If the run already has a `output.wp_post_id` from a prior
//      successful wp-draft, return that id WITHOUT calling WP.
//   2. Verify the editorial linkage is compatible:
//      - if run.editorial_item_id is set, it must equal the
//        `editorial_item_id` passed in this call.
//      - if the run has no editorial_item_id and the call passes
//        an editorial_item_id, we DO NOT silently switch links; we
//        fail closed (409 linkage_conflict).
//   3. Return the linkage status.
//
// The check MUST run BEFORE any WP createPost call to avoid
// double-drafts.

import "server-only";

export type WpDraftIdempotencyDecision =
  | {
      /** A prior successful wp-draft exists for this run. Reuse it. */
      ok: true;
      reuse: true;
      wp_post_id: number;
      reason: "run_output_wp_post_id_reused";
    }
  | {
      /** No prior draft exists for this run; proceed to createPost. */
      ok: true;
      reuse: false;
      reason: "no_prior_draft";
    }
  | {
      /** Caller is talking about a different editorial linkage. */
      ok: false;
      status: 409;
      error: "linkage_conflict";
      details: {
        run_editorial_item_id: string | null;
        request_editorial_item_id: string | null;
      };
    }
  | {
      /** run.output exists but wp_post_id is malformed. */
      ok: false;
      status: 409;
      error: "run_wp_id_invalid";
    };

/**
 * Inspect a run row + the request's editorial_item_id and decide what
 * the wp-draft route should do.
 *
 * @param runOutput        `automation_runs.output` column (or null)
 * @param runEditorialId   `automation_runs.editorial_item_id` (or null)
 * @param requestEditorial  the `editorial_item_id` field of this request (or null)
 */
export function decideWpDraft(
  runOutput: unknown,
  runEditorialId: string | null,
  requestEditorial: string | undefined,
): WpDraftIdempotencyDecision {
  const existing = (runOutput ?? {}) as { wp_post_id?: unknown };
  const prevId = existing.wp_post_id;

  if (prevId !== undefined && prevId !== null) {
    if (typeof prevId !== "number" || !Number.isInteger(prevId) || prevId <= 0) {
      return { ok: false, status: 409, error: "run_wp_id_invalid" };
    }
    // Linkage check: if either side declares a different value, refuse.
    const req = requestEditorial ?? null;
    if (
      (runEditorialId !== null && req !== null && runEditorialId !== req) ||
      (runEditorialId === null && req !== null) ||
      (runEditorialId !== null && req === null)
    ) {
      return {
        ok: false,
        status: 409,
        error: "linkage_conflict",
        details: {
          run_editorial_item_id: runEditorialId,
          request_editorial_item_id: req,
        },
      };
    }
    return {
      ok: true,
      reuse: true,
      wp_post_id: prevId,
      reason: "run_output_wp_post_id_reused",
    };
  }

  // No prior draft. Enforce the same linkage-consistency rule
  // (treat the freshly created path uniformly).
  const req = requestEditorial ?? null;
  if (
    (runEditorialId !== null && req !== null && runEditorialId !== req) ||
    (runEditorialId === null && req !== null) ||
    (runEditorialId !== null && req === null)
  ) {
    return {
      ok: false,
      status: 409,
      error: "linkage_conflict",
      details: {
        run_editorial_item_id: runEditorialId,
        request_editorial_item_id: req,
      },
    };
  }

  return { ok: true, reuse: false, reason: "no_prior_draft" };
}
