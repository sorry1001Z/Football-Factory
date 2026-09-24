import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { assertAutomationEnabled, automationDisabledResponse } from "@/lib/automation/kill-switch";
import { AUTOMATION_RL, consumeAutomationRateLimit, rateLimitedResponse } from "@/lib/automation/rate-limit-helpers";
import { withTx } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

const Schema = z.object({ recovery_id: z.string().uuid() });

type RecoveryRow = {
  id: string;
  run_id: string;
  editorial_item_id: string;
  recovery_status: "queued" | "claimed" | "completed" | "refused" | "expired";
  available_at: string;
  claimed_at: string | null;
  attempt: number;
  resume_stage: string;
  run_status: string;
  workflow: string;
  input: unknown;
  output: unknown;
  run_stage: string | null;
  error_class: string | null;
  recovery_count: number;
  source_id: string;
  wp_post_id: number | null;
  approval_state: string;
  editorial_stage: string;
  metadata: unknown;
  draft_operation_status: "started" | "created" | "uncertain" | "failed" | null;
};

export async function POST(request: Request) {
  const auth = verifyAutomationSecret(request);
  if (!auth.ok) return authRejectResponse(auth);
  const killSwitch = assertAutomationEnabled();
  if (!killSwitch.ok) return automationDisabledResponse();
  const rateLimit = consumeAutomationRateLimit(request, AUTOMATION_RL.recoveryClaim);
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
    const selected = await tx.query<RecoveryRow>(
      `SELECT recovery.id, recovery.run_id, recovery.editorial_item_id,
              recovery.status AS recovery_status, recovery.available_at,
              recovery.claimed_at, recovery.attempt, recovery.resume_stage,
              run.status AS run_status, run.workflow, run.input, run.output,
              run.stage AS run_stage, run.error_class, run.recovery_count,
              item.source_id, item.wp_post_id, item.approval_state,
              item.stage AS editorial_stage, item.metadata
              , draft.status AS draft_operation_status
         FROM automation_run_recoveries recovery
         JOIN automation_runs run ON run.id = recovery.run_id
         JOIN editorial_items item ON item.id = recovery.editorial_item_id
         LEFT JOIN wp_draft_operations draft ON draft.run_id = run.id
        WHERE recovery.id = $1
        FOR UPDATE OF recovery, run, item`,
      [validation.data.recovery_id],
    );
    const recovery = selected.rows[0];
    if (!recovery) return { status: 404 as const, body: { ok: false, error: "recovery_not_found" } };
    if (recovery.recovery_status !== "queued") {
      return { status: 409 as const, body: { ok: false, error: "recovery_already_claimed" } };
    }
    const availableAt = Date.parse(recovery.available_at);
    if (Number.isFinite(availableAt) && availableAt > Date.now()) {
      return { status: 409 as const, body: { ok: false, error: "recovery_backoff_active", retry_after_ms: availableAt - Date.now() } };
    }
    if (recovery.run_status !== "recovery_queued" || recovery.wp_post_id !== null || asRecord(recovery.output).wp_post_id || recovery.draft_operation_status) {
      return { status: 409 as const, body: { ok: false, error: "recovery_state_conflict" } };
    }
    const claimed = await tx.query<{ id: string }>(
      `UPDATE automation_run_recoveries
          SET status = 'claimed', attempt = attempt + 1,
              claimed_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'queued' AND available_at <= now()
        RETURNING id`,
      [recovery.id],
    );
    if (!claimed.rows[0]) return { status: 409 as const, body: { ok: false, error: "recovery_claim_race" } };
    const runUpdate = await tx.query<{ id: string }>(
      `UPDATE automation_runs
          SET status = 'running', error_class = NULL, updated_at = now()
        WHERE id = $1 AND status = 'recovery_queued'
        RETURNING id`,
      [recovery.run_id],
    );
    if (!runUpdate.rows[0]) throw new Error("recovery_run_transition_lost");
    await tx.query(
      `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
       VALUES ('run_recovery_claimed', 'automation_run', $1, $2::jsonb)`,
      [recovery.run_id, JSON.stringify({ recovery_id: recovery.id, attempt: recovery.attempt + 1 })],
    );

    const input = asRecord(recovery.input);
    const metadata = asRecord(recovery.metadata);
    const optionalMetadata = asRecord(input.optional_metadata);
    delete optionalMetadata.test_content;
    delete optionalMetadata.test_marker;
    const envelope = {
      ...input,
      run_id: recovery.run_id,
      editorial_item_id: recovery.editorial_item_id,
      source_id: recovery.source_id,
      source_url: metadata.source_url ?? input.source_url ?? null,
      source_title: metadata.source_title ?? input.source_title ?? null,
      publisher: metadata.publisher ?? metadata.source_name ?? input.publisher ?? null,
      published_at: metadata.published_at ?? input.published_at ?? null,
      source_type: metadata.source_type ?? input.source_type ?? null,
      source_text: metadata.source_text ?? input.source_text ?? null,
      news_type: metadata.news_type ?? input.news_type ?? null,
      title_th: metadata.title_th ?? input.title_th ?? null,
      body_th: metadata.body_th ?? input.body_th ?? null,
      excerpt_th: metadata.excerpt_th ?? input.excerpt_th ?? null,
      slug: metadata.slug ?? input.slug ?? null,
      optional_metadata: optionalMetadata,
      test_mode: false,
      recovery_id: recovery.id,
      pipeline_stage: recovery.resume_stage,
      pipeline_status: "accepted",
    };
    return { status: 200 as const, body: { ok: true, ...envelope } };
  });

  return NextResponse.json(result.body, { status: result.status });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}
