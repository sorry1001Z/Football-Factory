// Football Factory — POST /api/admin/editorial/[id]/approval (FIRST SLICE / 003)
//
// Human-approval mutation path. Sets approval_state on an editorial item.
// Editor/admin only. CSRF protected. Body-cap 1 MB. Zod validation.
// Audit log row written.
//
// Body: { state: "approved" | "rejected", note?: string }
//
// This is the ONLY path that can flip approval_state to a non-pending
// value. wp-publish refuses to publish unless approval_state == 'approved'.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAdminOrEditor,
  guardResponse,
} from "@/lib/admin/guard";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

const Schema = z.object({
  state: z.enum(["approved", "rejected"]),
  note: z.string().max(1000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;
  if (!g.ok) {
    // Unreachable when guardResponse is null, but TS narrowing.
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rl = consume(`admin_approval:${g.session.userId}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", reset_ms: rl.reset_ms },
      { status: 429 },
    );
  }

  const body = await readCappedBody(request, "admin");
  if (!body.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: body.reason === "too_large" ? "body_too_large" : "body_invalid",
      },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const v = Schema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }

  const { id } = await context.params;

  const db = getDb();
  const repo = new EditorialRepository(db);
  const existing = await repo.findById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const updated = await repo.setApproval(id, v.data.state, g.session.userId);

  // Audit log entry. We write to audit_logs directly (not via
  // AutomationLogRepository) because the actor is a real user, not
  // automation, and the resource_type is 'editorial_item'.
  const ipHash = ipOf(request); // ipOf may be empty in tests; fine.
  await db.query(
    `INSERT INTO audit_logs
       (actor_user_id, action, resource_type, resource_id,
        request_id, ip_hash, metadata)
     VALUES
       ($1, $2, 'editorial_item', $3,
        NULL, $4, $5::jsonb)`,
    [
      g.session.userId,
      `editorial_${v.data.state}`,
      id,
      ipHash || null,
      JSON.stringify({
        previous_state: existing.approval_state,
        new_state: v.data.state,
        note: v.data.note ?? null,
      }),
    ],
  );

  return NextResponse.json(
    {
      ok: true,
      editorial_item_id: updated.id,
      approval_state: updated.approval_state,
      approved_by: updated.approved_by,
      approved_at: updated.approved_at,
      audit_logged: true,
    },
    { status: 200 },
  );
}
