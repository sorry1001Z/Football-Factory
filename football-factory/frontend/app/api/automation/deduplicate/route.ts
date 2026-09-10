// /api/automation/deduplicate (FIRST SLICE)
//
// Auth:    x-automation-secret
// Body:    { idempotency_key, workflow, payload? }
//
// Behavior:
//   - idempotency_key REQUIRED (UNIQUE at the DB level).
//   - Concurrent submissions with the same key: exactly one INSERT
//     succeeds; subsequent attempts return the existing run.
//   - Returns { duplicate: bool, run_id, idempotency_key }.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";

export const dynamic = "force-dynamic";

const DedupSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(256),
  workflow: z.string().trim().min(1).max(64).default("unknown"),
  payload: z.unknown().optional(),
});

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
  const v = DedupSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured" },
      { status: 503 },
    );
  }
  const repo = new AutomationRunRepository(getDb());
  try {
    const claim = await repo.claim({
      idempotency_key: v.data.idempotency_key,
      workflow: v.data.workflow,
      payload: v.data.payload ?? {},
    });
    return NextResponse.json(
      {
        ok: true,
        duplicate: !claim.inserted,
        run_id: claim.run_id,
        idempotency_key: v.data.idempotency_key,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "dedupe_failed" },
      { status: 500 },
    );
  }
}
