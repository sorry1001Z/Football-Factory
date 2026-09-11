// Football Factory — POST /api/admin/editorial/[id]/approval (FIRST SLICE / 003 +
// CROSS-ROUTE SAFETY PATCH)
//
// Human-approval mutation path. Sets approval_state on an editorial item
// AND advances the editorial stage in the same logical operation:
//   - state = approved  → stage = approved (requires rights_confirmed=true)
//   - state = rejected  → stage = rejected (no precondition)
//
// Editor/admin only. CSRF protected. Body-cap 1 MB. Zod validation.
// Audit log row written.
//
// Rights precondition: this is the FIRST of two defense-in-depth gates.
// Even if a caller can bypass wp-publish's rights check (or an admin
// hand-edits an item), the admin-approval mutation itself refuses to
// set approval_state='approved' unless rights_confirmed is true. The
// only way to approve is to have first cleared media rights.
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

  // Defense-in-depth #1 — rights clearance precondition for approval.
  // state='rejected' is unconditionally permitted (operators can still
  // reject an item even if rights are not cleared). state='approved'
  // is allowed ONLY when rights_confirmed is true.
  if (v.data.state === "approved" && !existing.rights_confirmed) {
    const rightsMeta =
      (existing.metadata as { rights?: { state?: string } } | null)?.rights;
    const rightsState = rightsMeta?.state ?? "missing";
    return NextResponse.json(
      {
        ok: false,
        error: "rights_not_cleared_before_approve",
        editorial_item_id: existing.id,
        rights_state: rightsState,
        rights_confirmed: false,
      },
      { status: 409 },
    );
  }

  // Persist approval_state first via setApproval (existing helper).
  const updated = await repo.setApproval(id, v.data.state, g.session.userId);

  // Sync editorial_items.stage to the matching canonical stage:
  //   state=approved → stage=approved
  //   state=rejected → stage=rejected
  // The stage machine allows both as forward moves from any non-terminal
  // stage (the stage machine treats rejected as a non-additive path).
  //
  // Residual risk: setApproval and setStage are two separate UPDATEs.
  // If setStage fails AFTER setApproval succeeded, approval_state would
  // already be flipped. We treat that as a recoverable error — the audit
  // log shows the operator's intent, and an operator can re-attempt.
  let stageAdvanceWarning: string | null = null;
  const targetStage = v.data.state === "approved" ? "approved" : "rejected";
  let finalStage = updated.stage; // falls back to setApproval's row stage
  try {
    const after = await repo.setStage(updated.id, targetStage, null, `admin_${v.data.state}`);
    finalStage = after.stage;
  } catch (e) {
    stageAdvanceWarning = "stage_advance_warning: " + ((e as Error)?.message ?? "unknown");
  }

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
        previous_stage: existing.stage,
        new_stage: updated.stage,
        stage_advance_warning: stageAdvanceWarning,
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
      stage: finalStage,
      audit_logged: true,
      ...(stageAdvanceWarning ? { stage_advance_warning: stageAdvanceWarning } : {}),
    },
    { status: 200 },
  );
}
