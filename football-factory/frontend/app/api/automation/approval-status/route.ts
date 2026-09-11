// /api/automation/approval-status (FIRST SLICE / 003)
//
// Auth:    x-automation-secret
// Body:    { run_id } OR { editorial_item_id }
//
// Behavior:
//   - Looks up the editorial item via run_id (preferred) or directly by id.
//   - Returns its approval_state plus actor + timestamp metadata.
//   - Unknown item -> 404.
//   - Never defaults to 'approved'. New items default to 'pending'.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    run_id: z.string().uuid().optional(),
    editorial_item_id: z.string().uuid().optional(),
  })
  .refine(
    (v) => Boolean(v.run_id || v.editorial_item_id),
    { message: "run_id_or_editorial_item_id_required" },
  );

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  const body = await readCappedBody(request, "automation");
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" },
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

  const repo = new EditorialRepository(getDb());
  const item =
    v.data.editorial_item_id !== undefined
      ? await repo.findById(v.data.editorial_item_id)
      : v.data.run_id !== undefined
      ? await repo.findByRunId(v.data.run_id)
      : null;

  if (!item) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      approval_state: item.approval_state,
      approved_by: item.approved_by,
      approved_at: item.approved_at,
      editorial_item_id: item.id,
      wp_post_id: item.wp_post_id,
      stage: item.stage,
    },
    { status: 200 },
  );
}
