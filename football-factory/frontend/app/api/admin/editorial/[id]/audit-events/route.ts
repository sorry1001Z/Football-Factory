// Football Factory — GET /api/admin/editorial/[id]/audit-events
// (R2 Wave 2C)
//
// Read the audit_logs rows for a single editorial item. UI-safe
// surface: id, at, action, actor, summary, metadataSafe. Secrets
// are redacted recursively and oversized payloads are capped.
//
// Auth: session + admin/editor role only. CSRF not required (GET).
//
// Sort: oldest → newest (timeline rendering). Hard cap: 200 rows.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/postgres";
import { normalizeAuditRow } from "@/lib/admin/adapter";
import type { AuditEvent } from "@/lib/admin/contracts";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

const IdSchema = z.object({ id: z.string().uuid() });

const MAX_ROWS = 200;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;

  const { id } = await ctx.params;
  const parsed = IdSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  // Verify the editorial item exists; otherwise return 404 instead
  // of an empty list (so the UI shows a clean "not found" state).
  const repo = new EditorialRepository(getDb());
  const item = await repo.findById(parsed.data.id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const r = await getDb().query<{
    id: number | string;
    created_at: string;
    action: string;
    actor_user_id: string | null;
    metadata: unknown;
  }>(
    `SELECT id, created_at, action, actor_user_id, metadata
       FROM audit_logs
      WHERE resource_type = 'editorial_item'
        AND resource_id = $1
      ORDER BY created_at ASC
      LIMIT $2`,
    [parsed.data.id, MAX_ROWS],
  );

  const events: AuditEvent[] = r.rows.map(normalizeAuditRow);
  return NextResponse.json(
    { ok: true, items: events, total: events.length, editorialItemId: item.id },
    { status: 200 },
  );
}
