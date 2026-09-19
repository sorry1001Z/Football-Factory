// Football Factory — POST /api/admin/editorial/create
//
// Admin-session equivalent of /api/automation/editorial-item.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, source_id, title, source_url?, source_name?, metadata? }
//
// Behavior:
//   - Verify run exists; reject if not.
//   - Resolve editorial_item via source_id (idempotency):
//       - existing + compatible        -> return existing row.
//       - existing + incompatible run  -> 409 incompatible_run_editorial_link.
//       - missing                      -> create with stage=editorial_created.
//   - Persist run.editorial_item_id FK (linkToRun).
//   - Stage = "editorial_created", approval_state = "pending".
//   - No rights auto-clear. No approval auto-set. No publish.
//   - Audit log.

import "server-only";
import { z } from "zod";
import { runPipelineStep, resultToResponse } from "@/lib/admin/pipeline-runner";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";
import { redactSecrets } from "@/lib/auth/redact-secrets";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
  source_id: z.string().trim().min(1).max(256),
  title: z.string().trim().min(1).max(500),
  source_url: z.string().trim().max(2048).optional(),
  source_name: z.string().trim().max(256).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const r = await runPipelineStep(
    request,
    {
      bucket: "create",
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

      // 1) run must exist
      const run = await runs.get(body.run_id);
      if (!run) {
        return {
          ok: false as const,
          status: 404 as const,
          error: "run_not_found",
        };
      }

      // 2) find or create editorial_item
      let item = await items.findBySourceId(body.source_id);
      let created = false;
      if (!item) {
        try {
          item = await items.create({
            source_id: body.source_id,
            stage: "editorial_created",
            title: body.title,
            source_url: body.source_url,
            source_name: body.source_name,
            metadata: body.metadata
              ? (redactSecrets(body.metadata) as Record<string, unknown>)
              : undefined,
          });
          created = true;
        } catch (e) {
          // Race: another admin created concurrently with same source_id.
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("CONSTRAINT") || msg.includes("duplicate")) {
            item = await items.findBySourceId(body.source_id);
            if (!item) throw e;
          } else {
            throw e;
          }
        }
      }

      // 3) link run to editorial_item
      const link = await items.linkToRun(body.run_id, item.id);
      if (link.conflicting) {
        return {
          ok: false as const,
          status: 409 as const,
          error: "incompatible_run_editorial_link",
          details: { editorial_item_id: link.editorial_item_id },
        };
      }

      // 4) audit log
      await logs.insert({
        run_id: body.run_id,
        action: created
          ? "admin_editorial_item_created"
          : "admin_editorial_item_idempotent",
        stage: item.stage,
        status: "ok",
        message: created ? "ADMIN create" : "ADMIN create idempotent",
        metadata: {
          editorial_item_id: item.id,
          source_id: body.source_id,
          linked: link.linked,
          actor_user_id: session.userId,
        },
        request_id: null,
        ip_hash: null,
      });

      return {
        ok: true as const,
        status: created ? (201 as const) : (200 as const),
        body: {
          ok: true,
          editorial_item_id: item.id,
          run_id: body.run_id,
          stage: item.stage,
          approval_state: item.approval_state,
          created,
          linked: link.linked,
        },
      };
    },
  );

  return resultToResponse(r);
}
