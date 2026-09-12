// Football Factory — GET /api/admin/automation/[runId] (R2 Wave 2C)
//
// Read a single automation_runs row + linked editorial item
// summary + the most-recent 50 audit events.
//
// NEVER returns:
//   - automation secret
//   - WordPress password
//   - database URL
//   - raw credentials
//   - sensitive request headers
//
// Auth: session + admin/editor role only. CSRF not required (GET).

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import {
  normalizeAuditRow,
  normalizeRunRow,
} from "@/lib/admin/adapter";
import type { AuditEvent } from "@/lib/admin/contracts";
import type { AutomationRunResponse } from "@/lib/admin/contracts";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

const IdSchema = z.object({ runId: z.string().uuid() });

const RECENT_EVENTS = 50;

interface RunRow {
  id: string;
  workflow: string;
  status: string;
  stage: string | null;
  error_class: string | null;
  editorial_item_id: string | null;
  wp_post_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;

  const { runId } = await ctx.params;
  const parsed = IdSchema.safeParse({ runId });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_run_id" },
      { status: 400 },
    );
  }

  // 1. Fetch the run. We select ONLY the safe columns; the raw
  //    metadata and any internal columns never reach the response.
  const r = await getDb().query<RunRow>(
    `SELECT id, workflow, status, stage, error_class,
            editorial_item_id, wp_post_id, created_at, updated_at
       FROM automation_runs
      WHERE id = $1
      LIMIT 1`,
    [parsed.data.runId],
  );
  const run = r.rows[0];
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  // 2. Linked editorial item (via the deterministic FK from
  //    migration 003). If NULL, we surface `null` and the UI shows
  //    a clear "no editorial link" state.
  const repo = new EditorialRepository(getDb());
  const item = run.editorial_item_id
    ? await repo.findById(run.editorial_item_id)
    : null;

  // 3. Recent audit logs for this run. Bound to a small window to
  //    keep responses tight.
  const ev = await getDb().query<{
    id: number | string;
    created_at: string;
    action: string;
    actor_user_id: string | null;
    metadata: unknown;
  }>(
    `SELECT id, created_at, action, actor_user_id, metadata
       FROM audit_logs
      WHERE resource_type = 'automation_run'
        AND resource_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [parsed.data.runId, RECENT_EVENTS],
  );
  const recentEvents: AuditEvent[] = ev.rows
    .map(normalizeAuditRow)
    .reverse(); // surface in chronological order for the timeline.

  const body: AutomationRunResponse = {
    ok: true,
    run: normalizeRunRow(run),
    editorialItem: item,
    recentEvents,
  };
  return NextResponse.json(body, { status: 200 });
}
