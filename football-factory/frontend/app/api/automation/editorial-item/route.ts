// /api/automation/editorial-item  (PRE-N8N BACKEND — FF_HOOK_3)
//
// Auth:    x-automation-secret
// Body:    { run_id, source_id, title?, source_url?, source_name?, metadata? }
//
// Behavior:
//   - Validate run exists              -> 404 if missing.
//   - Resolve editorial_item via source_id:
//       - existing + compatible        -> idempotent return.
//       - existing + incompatible run  -> 409 incompatible_run_editorial_link.
//       - missing                      -> create with stage=editorial_created.
//   - Persist run.editorial_item_id FK (linkToRun).
//   - Stage = `editorial_created`, approval_state = `pending`.
//   - Idempotent: same source_id returns the same row.
//   - Does NOT create any WP post.
//
// Returns: editorial_item_id, run_id, stage, approval_state.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { redactSecrets } from "@/lib/auth/redact-secrets";
import {
  verifyAutomationSecret,
  authRejectResponse,
} from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";

export const dynamic = "force-dynamic";

const Hook3Schema = z.object({
  run_id: z.string().uuid(),
  source_id: z.string().trim().min(1).max(256),
  title: z.string().trim().min(1).max(500).optional(),
  source_url: z.string().trim().max(2048).optional(),
  source_name: z.string().trim().max(256).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const a = verifyAutomationSecret(request);
  if (!a.ok) return authRejectResponse(a);

  const body = await readCappedBody(request, "automation");
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
  const v = Hook3Schema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured" },
      { status: 503 },
    );
  }

  const db = getDb();
  const runs = new AutomationRunRepository(db);
  const items = new EditorialRepository(db);
  const logs = new AutomationLogRepository(db);

  // 1) run exists
  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "run_not_found" },
      { status: 404 },
    );
  }

  // 2) find by source_id (idempotency key)
  let existing = await items.findBySourceId(v.data.source_id);
  let created = false;
  if (!existing) {
    try {
      existing = await items.create({
        source_id: v.data.source_id,
        stage: "editorial_created",
        title: v.data.title,
        source_url: v.data.source_url,
        source_name: v.data.source_name,
        metadata: v.data.metadata
          ? (redactSecrets(v.data.metadata) as Record<string, unknown>)
          : undefined,
      });
      created = true;
    } catch (e) {
      // Race: another caller created it concurrently with the same
      // source_id. Re-lookup; if found, reflow as idempotent. Otherwise
      // rethrow.
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("CONSTRAINT") || msg.includes("duplicate")) {
        existing = await items.findBySourceId(v.data.source_id);
        if (!existing) throw e;
      } else {
        throw e;
      }
    }
  }

  // 3) linkToRun enforces run <-> editorial_item association.
  const link = await items.linkToRun(v.data.run_id, existing.id);
  if (link.conflicting) {
    return NextResponse.json(
      {
        ok: false,
        error: "incompatible_run_editorial_link",
        editorial_item_id: link.editorial_item_id,
      },
      { status: 409 },
    );
  }

  // 4) audit log
  await logs.insert({
    run_id: v.data.run_id,
    action: created
      ? "editorial_item_created"
      : "editorial_item_idempotent",
    stage: existing.stage,
    status: "ok",
    message: created ? "FF_HOOK_3 created" : "FF_HOOK_3 idempotent",
    metadata: {
      editorial_item_id: existing.id,
      source_id: v.data.source_id,
      linked: link.linked,
    },
    request_id: null,
    ip_hash: null,
  });

  return NextResponse.json(
    {
      ok: true,
      editorial_item_id: existing.id,
      run_id: v.data.run_id,
      stage: existing.stage,
      approval_state: existing.approval_state,
      created,
      linked: link.linked,
    },
    { status: created ? 201 : 200 },
  );
}
