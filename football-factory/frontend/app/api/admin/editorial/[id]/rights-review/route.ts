// Football Factory — POST /api/admin/editorial/[id]/rights-review (HUMAN REVIEW).
//
// Editor/admin-only human mutation path for media-rights clearance. Without a
// configured RIGHTS_PROVIDER_URL, FF_HOOK_6 cannot set rights_confirmed=true
// (the automation route always returns provider_not_configured_for_cleared_state).
// This route is the only path that lets a human editor set the
// `editorial_items.rights_confirmed` boolean to `true` in production today.
//
// Auth:    ff_session (editor or admin)
// CSRF:    required
// Body:    1 MB cap, zod validated
// Audit:   one row per mutation in audit_logs
// Secret:  no raw Authorization/Cookie/secret persisted; structured
//          evidence is shallow-sanitized recursively
// Stage:   `decision=rejected` moves the editorial stage to "rejected"
//          (terminal) per the stage-machine canonical path.
//          `decision=cleared|manual_review` does NOT auto-promote stage.

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
import { redactSecrets } from "@/lib/auth/redact-secrets";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

// Structured evidence required when decision='cleared'. The minimum is set
// by the brief; commercial_use_confirmed and one of
// news_or_editorial_use_confirmed / license_name are mandatory. We enforce
// all four to keep the audit evidence substantive.
const ClearedEvidenceSchema = z
  .object({
    source_url: z.string().trim().url().max(2048),
    source_name: z.string().trim().min(1).max(256).optional(),
    author: z.string().trim().min(1).max(256).optional(),
    license_name: z.string().trim().min(1).max(256),
    license_url: z.string().trim().url().max(2048).optional(),
    attribution_text: z.string().trim().min(1).max(1024).optional(),
    commercial_use_confirmed: z.literal(true),
    news_or_editorial_use_confirmed: z.literal(true).optional(),
    notes: z.string().trim().max(2048).optional(),
  })
  .strict();

const RightsReviewSchema = z
  .object({
    decision: z.enum(["cleared", "rejected", "manual_review"]),
    evidence: ClearedEvidenceSchema.optional(),
    notes: z.string().trim().max(2048).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "cleared" && !v.evidence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence_required_when_cleared",
        path: ["evidence"],
      });
    }
  });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const g = requireAdminOrEditor(request);
  const resp = guardResponse(g);
  if (resp !== null) return resp;
  if (!g.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rl = consume(`admin_rights_review:${g.session.userId}`, 60, 60_000);
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
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }
  const v = RightsReviewSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  const db = getDb();
  const repo = new EditorialRepository(db);
  const existing = await repo.findById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Strip terminal-protection: cannot review an item that is already
  // terminal-stage (rejected|failed|published). approved-stage items can
  // still be re-reviewed if a human wants to revoke rights (decision=
  // rejected or manual_review); cleared can only happen on a non-terminal
  // stage so a published item cannot be silently re-stamped as cleared.
  if (existing.stage === "rejected" || existing.stage === "failed" || existing.stage === "published") {
    return NextResponse.json(
      {
        ok: false,
        error: "terminal_state_no_mutation",
        stage: existing.stage,
      },
      { status: 409 },
    );
  }

  const previousState = (
    (existing.metadata as { rights?: { state?: string } } | null)?.rights?.state ?? "missing"
  );

  // Persist decision + evidence (no secrets logged). We redact recursively
  // before writing so a future editor cannot shovel Authorization/Cookie/
  // token headers through `notes` or any field.
  const safeEvidence = v.data.evidence
    ? (redactSecrets(v.data.evidence) as Record<string, unknown>)
    : null;

  let rightsConfirmed: boolean;
  let rightsState: "cleared" | "rejected" | "manual_review";
  let notes: string | null = v.data.notes ?? null;
  let stageAdvanceWarning: string | null = null;

  if (v.data.decision === "cleared") {
    rightsConfirmed = true;
    rightsState = "cleared";
  } else if (v.data.decision === "rejected") {
    rightsConfirmed = false;
    rightsState = "rejected";
  } else {
    rightsConfirmed = false;
    rightsState = "manual_review";
  }

  // Now write to metadata.rights and rights_confirmed. We do this as a
  // single UPDATE so reviewers cannot observe a half-persisted state.
  // The UPDATE statement also fails the request if metadata has a
  // non-object value (defensive: COALESCE '{}'::jsonb).
  const rightsRecord = JSON.stringify({
    state: rightsState,
    method: "human_review",
    reviewed_by: g.session.userId,
    reviewed_at: new Date().toISOString(),
    previous_state: previousState,
    ...(safeEvidence ?? {}),
    ...(notes ? { notes } : {}),
  });
  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object('rights', $2::jsonb),
            rights_confirmed = $3::bool,
            updated_at = now()
      WHERE id = $1`,
    [existing.id, rightsRecord, rightsConfirmed],
  );

  // Stage change on rejection: terminal.
  if (rightsState === "rejected") {
    try {
      await repo.setStage(existing.id, "rejected", null, "admin_rights_review");
    } catch (e) {
      stageAdvanceWarning = "stage_advance_warning: " + ((e as Error)?.message ?? "unknown");
    }
  }

  // Audit log entry.
  const ipHash = ipOf(request);
  await db.query(
    `INSERT INTO audit_logs
       (actor_user_id, action, resource_type, resource_id,
        request_id, ip_hash, metadata)
     VALUES
       ($1, $2, 'editorial_item', $3,
        NULL, $4, $5::jsonb)`,
    [
      g.session.userId,
      `editorial_rights_review_${rightsState}`,
      existing.id,
      ipHash || null,
      JSON.stringify({
        previous_state: previousState,
        new_state: rightsState,
        rights_confirmed: rightsConfirmed,
        evidence_provided: Boolean(safeEvidence),
        notes_provided: Boolean(notes),
      }),
    ],
  );

  // Re-read the row to confirm the persisted state and return authoritative
  // values to the operator UI.
  const after = await repo.findById(existing.id);

  return NextResponse.json(
    {
      ok: true,
      editorial_item_id: existing.id,
      decision: rightsState,
      rights_confirmed: rightsConfirmed,
      previous_state: previousState,
      stage: after?.stage ?? existing.stage,
      audit_logged: true,
      ...(stageAdvanceWarning ? { stage_advance_warning: stageAdvanceWarning } : {}),
    },
    { status: 200 },
  );
}
