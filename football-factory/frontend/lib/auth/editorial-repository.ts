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
  rights_confirmed: boolean;
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
              approved_by, approved_at, rights_confirmed, metadata,
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
              approved_by, approved_at, rights_confirmed, metadata,
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
              approved_by, approved_at, rights_confirmed, metadata,
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
                  approved_by, approved_at, rights_confirmed, metadata,
                  created_at, updated_at`,
      [id, state, actorUserId],
    );
    const x = r.rows[0];
    if (!x) throw new Error("editorial_set_approval_no_row");
    return x;
  }

  /**
   * Look up an editorial item by its unique `source_id`. Returns null if no
   * row exists. Used by FF_HOOK_3 to provide source-level idempotency.
   */
  async findBySourceId(sourceId: string): Promise<EditorialItem | null> {
    const r = await this.db.query<EditorialItem>(
      `SELECT id, source_id, wp_post_id, stage, approval_state,
              approved_by, approved_at, rights_confirmed, metadata,
              created_at, updated_at
         FROM editorial_items
        WHERE source_id = $1
        LIMIT 1`,
      [sourceId],
    );
    return r.rows[0] ?? null;
  }

  /**
   * Persist the link between an automation run and an editorial item.
   * This is a side-effect of FF_HOOK_3 (and may be set by wp-draft
   * when called via the run's input payload).
   *
   * Rejects calls where the run is already linked to a DIFFERENT item
   * (a run can only act on one editorial item at a time).
   */
  async linkToRun(runId: string, editorialItemId: string): Promise<{
    linked: boolean;
    conflicting: boolean;
    editorial_item_id: string | null;
  }> {
    // First check current linkage.
    const cur = await this.db.query<{ editorial_item_id: string | null }>(
      `SELECT editorial_item_id FROM automation_runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    const existing = cur.rows[0]?.editorial_item_id ?? null;
    if (existing === editorialItemId) {
      return { linked: false, conflicting: false, editorial_item_id: existing };
    }
    if (existing !== null && existing !== editorialItemId) {
      return { linked: false, conflicting: true, editorial_item_id: existing };
    }
    // existing === null → safe to set.
    const upd = await this.db.query<{ editorial_item_id: string }>(
      `UPDATE automation_runs
          SET editorial_item_id = $2
        WHERE id = $1 AND editorial_item_id IS NULL
        RETURNING editorial_item_id`,
      [runId, editorialItemId],
    );
    const newVal = upd.rows[0]?.editorial_item_id ?? null;
    return {
      linked: newVal === editorialItemId,
      conflicting: false,
      editorial_item_id: newVal ?? existing,
    };
  }

  /**
   * Move an editorial item to a new stage. Validates the transition via
   * the stage-machine before persisting. Persists `stage` and appends
   * a `stage_history` entry into `metadata` so the pipeline trail is
   * queryable for audits.
   */
  async setStage(
    id: string,
    toStage: string,
    actorRunId: string | null,
    note?: string,
  ): Promise<EditorialItem> {
    // Read current stage first.
    const cur = await this.findById(id);
    if (!cur) throw new Error("editorial_set_stage_no_row");
    // Lazy import to avoid a circular dep at module-eval time.
    const { assertTransition, isEditorialStage } = await import(
      "@/lib/auth/stage-machine"
    );
    // If the current stage is non-canonical (e.g. hand-edited), we still
    // accept any forward or terminal move per the stage-machine contract.
    if (isEditorialStage(cur.stage)) {
      assertTransition(cur.stage, toStage);
    } else if (!isEditorialStage(toStage)) {
      throw new Error("editorial_set_stage_invalid_target");
    }
    // Update stage + append stage_history.
    const r = await this.db.query<EditorialItem>(
      `UPDATE editorial_items
          SET stage     = $2,
              updated_at = now(),
              metadata  = COALESCE(metadata, '{}'::jsonb)
                         || jsonb_build_object(
                              'stage_history',
                              COALESCE(metadata->'stage_history', '[]'::jsonb)
                                || jsonb_build_array(
                                     jsonb_build_object(
                                       'from', $3::text,
                                       'to',   $2::text,
                                       'run_id', $4::text,
                                       'note', $5::text,
                                       'at',   to_jsonb(now())
                                     )
                                   )
                            )
        WHERE id = $1
        RETURNING id, source_id, wp_post_id, stage, approval_state,
                  approved_by, approved_at, rights_confirmed, metadata,
                  created_at, updated_at`,
      [id, toStage, cur.stage, actorRunId, note ?? null],
    );
    const x = r.rows[0];
    if (!x) throw new Error("editorial_set_stage_no_row");
    return x;
  }

  /**
   * Insert a new editorial_items row. Returns the row on success.
   * The DB-level UNIQUE constraint on `source_id` enforces idempotency;
   * the caller should catch PostgresError CONSTRAINT and re-lookup.
   */
  async create(input: {
    source_id: string;
    stage: string;
    title?: string;
    source_url?: string;
    source_name?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EditorialItem> {
    const metadataJson = JSON.stringify(input.metadata ?? {});
    const r = await this.db.query<EditorialItem>(
      `INSERT INTO editorial_items
         (source_id, stage, approval_state, metadata)
       VALUES
         ($1, $2, 'pending', $3::jsonb)
       RETURNING id, source_id, wp_post_id, stage, approval_state,
                 approved_by, approved_at, rights_confirmed, metadata,
                 created_at, updated_at`,
      [
        input.source_id,
        input.stage,
        metadataJson,
      ],
    );
    // Side-channel: stash title/source_url/source_name into metadata so
    // the editorial_item API consumers see them without a column change.
    if (input.title || input.source_url || input.source_name) {
      const meta = {
        ...(input.title ? { title: input.title } : {}),
        ...(input.source_url ? { source_url: input.source_url } : {}),
        ...(input.source_name ? { source_name: input.source_name } : {}),
      };
      // We persist those into metadata in a second statement to keep the
      // INSERT returning-row simple. This is the same DB transaction from
      // the caller's perspective; safe.
      await this.db.query(
        `UPDATE editorial_items
            SET metadata = metadata || $2::jsonb
          WHERE id = $1`,
        [r.rows[0].id, JSON.stringify(meta)],
      );
    }
    // Re-read to return the merged row.
    return (await this.findById(r.rows[0].id))!;
  }
}
