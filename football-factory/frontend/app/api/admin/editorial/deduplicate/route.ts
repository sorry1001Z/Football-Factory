// Football Factory — POST /api/admin/editorial/deduplicate
//
// Admin-session equivalent of /api/automation/deduplicate.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { source_id, title?, url? }  (operator-typed form)
//
// Behavior:
//   - Compute a deterministic idempotency_key = sha256(source_id).
//   - Claim an automation_runs row with workflow="admin_pilot".
//   - Check editorial_items for an existing row by source_id.
//     If found, return duplicate=true with the existing
//     editorial_item_id and run_id.
//     If not, return duplicate=false with a fresh run_id.
//   - Audit log: editorial_dedupe_checked.
//
// This endpoint does NOT create an editorial_items row. That happens
// in /api/admin/editorial/create. Two-step design so the operator
// can confirm "no duplicate" before committing.

import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { runPipelineStep, resultToResponse } from "@/lib/admin/pipeline-runner";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";

export const dynamic = "force-dynamic";

const Schema = z.object({
  source_id: z.string().trim().min(1).max(256),
  title: z.string().trim().max(500).optional(),
  url: z.string().trim().max(2048).optional(),
});

function makeKey(source_id: string): string {
  return `admin_dedupe:${crypto.createHash("sha256").update(source_id, "utf-8").digest("hex").slice(0, 32)}`;
}

export async function POST(request: Request) {
  const r = await runPipelineStep(
    request,
    {
      bucket: "deduplicate",
      limit: 30,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => {
      if (!process.env.DATABASE_URL) {
        return {
          ok: false as const,
          status: 503 as const,
          error: "database_not_configured",
        };
      }
      const db = getDb();
      const runs = new AutomationRunRepository(db);
      const items = new EditorialRepository(db);
      const logs = new AutomationLogRepository(db);

      const idemKey = makeKey(body.source_id);

      // Look up an existing editorial_item by source_id first.
      const existingItem = await items.findBySourceId(body.source_id);

      // Claim a run row. Whether or not we end up creating an
      // editorial_item, we want a stable run_id for the operator's
      // pilot.
      const claim = await runs.claim({
        idempotency_key: idemKey,
        workflow: "admin_pilot",
        payload: {
          source_id: body.source_id,
          title: body.title ?? null,
          url: body.url ?? null,
          actor_user_id: session.userId,
        },
      });

      if (existingItem) {
        await logs.insert({
          run_id: claim.run_id,
          action: "admin_dedupe_duplicate_found",
          stage: existingItem.stage,
          status: "ok",
          message: "FF_HOOK_ADMIN_DEDUPE duplicate",
          metadata: {
            source_id: body.source_id,
            editorial_item_id: existingItem.id,
            actor_user_id: session.userId,
          },
          request_id: null,
          ip_hash: null,
        });
        return {
          ok: true as const,
          status: 200 as const,
          body: {
            ok: true,
            duplicate: true,
            run_id: claim.run_id,
            idempotency_key: idemKey,
            editorial_item_id: existingItem.id,
            existing_stage: existingItem.stage,
          },
        };
      }

      await logs.insert({
        run_id: claim.run_id,
        action: "admin_dedupe_passed",
        stage: "ingested",
        status: "ok",
        message: "FF_HOOK_ADMIN_DEDUPE new",
        metadata: {
          source_id: body.source_id,
          actor_user_id: session.userId,
        },
        request_id: null,
        ip_hash: null,
      });

      return {
        ok: true as const,
        status: 200 as const,
        body: {
          ok: true,
          duplicate: false,
          run_id: claim.run_id,
          idempotency_key: idemKey,
          editorial_item_id: null,
        },
      };
    },
  );

  return resultToResponse(r);
}
