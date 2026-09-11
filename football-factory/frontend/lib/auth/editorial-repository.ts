// Football Factory — editorial repository (FIRST SLICE / 003).
//
// Wraps editorial_items queries. Editorial items represent a single
// piece of content in the human-approval pipeline. Each item has an
// `approval_state` of `pending` (default), `approved`, or `rejected`,
// set exclusively by the admin approval mutation path.
//
// The approval_state is a defensive gate: wp-publish MUST NOT publish
// a WP post unless the linked editorial_item is in `approved` state.

import "server-only";

import type { Db } from "@/lib/db/postgres";

export type ApprovalState = "pending" | "approved" | "rejected";

export type EditorialItem = {
  id: string;
  source_id: string;
  wp_post_id: number | null;
  stage: string;
  approval_state: ApprovalState;
  approved_by: string | null;
  approved_at: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export class EditorialRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<EditorialItem | null> {
    const r = await this.db.query<EditorialItem>(
      `SELECT id, source_id, wp_post_id, stage, approval_state,
              approved_by, approved_at, metadata,
              created_at, updated_at
         FROM editorial_items
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return r.rows[0] ?? null;
  }

  async findByWpPostId(wpPostId: number): Promise<EditorialItem | null> {
    // At most one row expected; if multiple exist, return the most
    // recently updated. The publish path uses this to verify that the
    // wp_post_id on a run matches the editorial item the operator
    // approved.
    const r = await this.db.query<EditorialItem>(
      `SELECT id, source_id, wp_post_id, stage, approval_state,
              approved_by, approved_at, metadata,
              created_at, updated_at
         FROM editorial_items
        WHERE wp_post_id = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [wpPostId],
    );
    return r.rows[0] ?? null;
  }

  async findByRunId(runId: string): Promise<EditorialItem | null> {
    // The deterministic linkage between a run and an editorial item is
    // via automation_runs.editorial_item_id (added in migration 003).
    // If that column is NULL on the run, we return null. wp-publish
    // will then refuse to publish with `editorial_link_missing`.
    const r = await this.db.query<{ editorial_item_id: string | null }>(
      `SELECT editorial_item_id FROM automation_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    const id = r.rows[0]?.editorial_item_id;
    if (!id) return null;
    return this.findById(id);
  }

  async listByApprovalState(state: ApprovalState, limit = 50): Promise<EditorialItem[]> {
    const r = await this.db.query<EditorialItem>(
      `SELECT id, source_id, wp_post_id, stage, approval_state,
              approved_by, approved_at, metadata,
              created_at, updated_at
         FROM editorial_items
        WHERE approval_state = $1
        ORDER BY updated_at DESC
        LIMIT $2`,
      [state, Math.max(1, Math.min(200, limit))],
    );
    return r.rows;
  }

  async setApproval(
    id: string,
    state: Exclude<ApprovalState, "pending">,
    actorUserId: string,
  ): Promise<EditorialItem> {
    // When approving or rejecting, we record the actor + timestamp.
    // When rejecting, we keep them too — a rejection is still an
    // approval decision and the audit trail must reflect who decided.
    const r = await this.db.query<EditorialItem>(
      `UPDATE editorial_items
          SET approval_state = $2,
              approved_by    = $3,
              approved_at    = now(),
              updated_at     = now()
        WHERE id = $1
        RETURNING id, source_id, wp_post_id, stage, approval_state,
                  approved_by, approved_at, metadata,
                  created_at, updated_at`,
      [id, state, actorUserId],
    );
    const x = r.rows[0];
    if (!x) throw new Error("editorial_set_approval_no_row");
    return x;
  }
}
