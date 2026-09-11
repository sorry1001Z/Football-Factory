// Football Factory — POST /api/admin/editorial/[id]/fact-review (HUMAN REVIEW).
//
// Editor/admin-only human mutation path for fact-check. The automation
// fact-check route (FF_HOOK_5) returns provider_status="not_configured"
// today and never sets fact_check_score=null safely without a provider.
// This route lets a human editor set metadata.fact_check.state to one of
// {cleared, flagged, rejected} after inspection. We deliberately
// never fabricate fact_check_score; that column is reserved for
// evidence-backed values.
//
// Auth:    ff_session (editor or admin)
// CSRF:    required
// Body:    1 MB cap, zod validated
// Audit:   one row per mutation in audit_logs
// Stage:   `decision=rejected` moves the editorial stage to "rejected"
//          (terminal). Cleared|flagged do NOT auto-promote stage.

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

const ClearedFactEvidenceSchema = z
  .object({
    claim_check_summary: z.string().trim().min(8).max(4096),
    claim_sources: z.array(z.string().trim().url().max(2048)).min(1).max(50),
    notes: z.string().trim().max(2048).optional(),
  })
  .strict();

const FactReviewSchema = z
  .object({
    decision: z.enum(["cleared", "flagged", "rejected"]),
    evidence: ClearedFactEvidenceSchema.optional(),
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

  const rl = consume(`admin_fact_review:${g.session.userId}`, 60, 60_000);
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
  const v = FactReviewSchema.safeParse(parsed);
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
    (existing.metadata as { fact_check?: { state?: string } } | null)?.fact_check?.state ?? "missing"
  );

  const safeEvidence = v.data.evidence
    ? (redactSecrets(v.data.evidence) as Record<string, unknown>)
    : null;
  const notes: string | null = v.data.notes ?? null;

  // IMPORTANT: we never write a fact_check_score. The column's only valid
  // values are 0..100 with NULL meaning "not reviewed by an automated
  // provider". A human review outcome is encoded only in metadata so the
  // column is preserved for the future wired provider.
  const factCheckRecord = JSON.stringify({
    state: v.data.decision,
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
                          || jsonb_build_object('fact_check', $2::jsonb),
            updated_at = now()
      WHERE id = $1`,
    [existing.id, factCheckRecord],
  );

  let stageAdvanceWarning: string | null = null;
  if (v.data.decision === "rejected") {
    try {
      await repo.setStage(existing.id, "rejected", null, "admin_fact_review");
    } catch (e) {
      stageAdvanceWarning = "stage_advance_warning: " + ((e as Error)?.message ?? "unknown");
    }
  }

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
      `editorial_fact_review_${v.data.decision}`,
      existing.id,
      ipHash || null,
      JSON.stringify({
        previous_state: previousState,
        new_state: v.data.decision,
        evidence_provided: Boolean(safeEvidence),
        notes_provided: Boolean(notes),
        fact_check_score: null,
      }),
    ],
  );

  const after = await repo.findById(existing.id);

  return NextResponse.json(
    {
      ok: true,
      editorial_item_id: existing.id,
      decision: v.data.decision,
      previous_state: previousState,
      stage: after?.stage ?? existing.stage,
      fact_check_score: null,
      audit_logged: true,
      ...(stageAdvanceWarning ? { stage_advance_warning: stageAdvanceWarning } : {}),
    },
    { status: 200 },
  );
}
