import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { assertAutomationEnabled, automationDisabledResponse } from "@/lib/automation/kill-switch";
import { AUTOMATION_RL, consumeAutomationRateLimit, rateLimitedResponse } from "@/lib/automation/rate-limit-helpers";
import { withTx } from "@/lib/db/postgres";
import { canTransitionRun } from "@/lib/automation/run-lifecycle";

export const dynamic = "force-dynamic";

const Schema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(["held_for_content", "failed"]),
  stage: z.string().trim().min(1).max(64),
  error_class: z.enum(["timeout", "network", "upstream_temporary", "auth", "validation", "unknown"]).optional(),
  reason: z.string().trim().min(1).max(256).optional(),
  recovery_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const auth = verifyAutomationSecret(request);
  if (!auth.ok) return authRejectResponse(auth);
  const killSwitch = assertAutomationEnabled();
  if (!killSwitch.ok) return automationDisabledResponse();
  const rateLimit = consumeAutomationRateLimit(request, AUTOMATION_RL.runRead);
  if (!rateLimit.ok) return rateLimitedResponse(rateLimit.resetMs);

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const validation = Schema.safeParse(parsed);
  if (!validation.success) return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });

  const result = await withTx(async (tx) => {
    const current = await tx.query<{ status: string; editorial_item_id: string | null }>(
      `SELECT status, editorial_item_id FROM automation_runs WHERE id = $1 FOR UPDATE`,
      [validation.data.run_id],
    );
    const row = current.rows[0];
    if (!row) return { status: 404 as const, body: { ok: false, error: "run_not_found" } };
    if (!row.editorial_item_id) return { status: 409 as const, body: { ok: false, error: "editorial_link_missing" } };
    if (row.status === validation.data.status) {
      return { status: 200 as const, body: { ok: true, idempotent: true, run_id: validation.data.run_id, status: row.status } };
    }
    if (!canTransitionRun(row.status, validation.data.status)) {
      return { status: 409 as const, body: { ok: false, error: "invalid_run_status_transition" } };
    }
    const updated = await tx.query<{ status: string }>(
      `UPDATE automation_runs
          SET status = $2, stage = $3, error_class = $4,
              error = $5, updated_at = now()
        WHERE id = $1 AND status = $6
        RETURNING status`,
      [validation.data.run_id, validation.data.status, validation.data.stage, validation.data.error_class ?? null, validation.data.reason ?? null, row.status],
    );
    if (!updated.rows[0]) return { status: 409 as const, body: { ok: false, error: "run_status_race" } };
    if (validation.data.recovery_id) {
      await tx.query(
        `UPDATE automation_run_recoveries
            SET status = 'completed', finished_at = now(), updated_at = now()
          WHERE id = $1 AND run_id = $2 AND status = 'claimed'`,
        [validation.data.recovery_id, validation.data.run_id],
      );
    }
    await tx.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
       VALUES ('run_status_updated', 'automation_run', $1, $2::jsonb)`,
      [validation.data.run_id, JSON.stringify({ from_status: row.status, to_status: validation.data.status, stage: validation.data.stage, error_class: validation.data.error_class ?? null, recovery_id: validation.data.recovery_id ?? null })],
    );
    return { status: 200 as const, body: { ok: true, run_id: validation.data.run_id, status: validation.data.status } };
  });
  return NextResponse.json(result.body, { status: result.status });
}
