import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import { readCappedBody } from "@/lib/security/body-cap";
import { withTx } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

const IdSchema = z.object({ id: z.string().uuid() });
const ContentSchema = z.object({
  title_th: z.string().trim().min(1).max(500),
  body_th: z.string().trim().min(200).max(1_000_000),
  excerpt_th: z.string().trim().max(500),
  slug: z.string().trim().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  news_type: z.enum(["RESULT", "PREVIEW", "ANALYSIS", "TRANSFER", "BREAKING"]),
  source_url: z.string().url().max(2048).refine((value) => value.startsWith("https://"), "source_url must use HTTPS"),
  source_title: z.string().trim().min(1).max(500),
  publisher: z.string().trim().min(1).max(256),
  author: z.string().trim().max(256),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminOrEditor(request);
  const denied = guardResponse(auth);
  if (denied) return denied;
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const { id } = await context.params;
  const parsedId = IdSchema.safeParse({ id });
  if (!parsedId.success) return NextResponse.json({ ok: false, error: "invalid_editorial_item_id" }, { status: 400 });

  const body = await readCappedBody(request, "automation");
  if (!body.ok) {
    return NextResponse.json({ ok: false, error: body.reason === "too_large" ? "body_too_large" : "body_invalid" }, { status: body.reason === "too_large" ? 413 : 400 });
  }
  let value: unknown;
  try {
    value = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = ContentSchema.safeParse(value);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation_failed", issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }, { status: 400 });
  }

  const result = await withTx(async (tx) => {
    const runResult = await tx.query<{ id: string; status: string; output: unknown }>(
      `SELECT id, status, output FROM automation_runs
        WHERE editorial_item_id = $1 AND status = 'held_for_content'
        ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
      [parsedId.data.id],
    );
    const run = runResult.rows[0];
    if (!run) {
      const exists = await tx.query<{ id: string }>(`SELECT id FROM editorial_items WHERE id = $1`, [parsedId.data.id]);
      return exists.rows[0]
        ? { status: 409 as const, body: { ok: false, error: "linked_run_not_found" } }
        : { status: 404 as const, body: { ok: false, error: "editorial_item_not_found" } };
    }

    const itemResult = await tx.query<{ id: string; source_id: string; wp_post_id: number | null; metadata: unknown }>(
      `SELECT id, source_id, wp_post_id, metadata
         FROM editorial_items WHERE id = $1 FOR UPDATE`,
      [parsedId.data.id],
    );
    const item = itemResult.rows[0];
    if (!item) return { status: 404 as const, body: { ok: false, error: "editorial_item_not_found" } };
    if (run.status !== "held_for_content") return { status: 409 as const, body: { ok: false, error: "run_not_held_for_content", run_status: run.status } };

    const output = asRecord(run.output);
    if (item.wp_post_id !== null || output.wp_post_id) {
      return { status: 409 as const, body: { ok: false, error: "wordpress_draft_already_exists" } };
    }
    const draft = await tx.query<{ status: string }>(
      `SELECT status FROM wp_draft_operations WHERE run_id = $1 LIMIT 1`,
      [run.id],
    );
    if (draft.rows[0]) return { status: 409 as const, body: { ok: false, error: "wordpress_draft_operation_exists", draft_status: draft.rows[0].status } };

    const content = parsed.data;
    const metadata = {
      ...asRecord(item.metadata),
      title_th: content.title_th,
      body_th: content.body_th,
      excerpt_th: content.excerpt_th,
      slug: content.slug,
      news_type: content.news_type,
      source_url: content.source_url,
      source_title: content.source_title,
      publisher: content.publisher,
      source_name: content.publisher,
      ...(content.author ? { author: content.author } : {}),
      editorial_completion: {
        source: "human_operator",
        actor_user_id: auth.ok ? auth.session.userId : null,
        completed_at: new Date().toISOString(),
      },
    };
    await tx.query(
      `UPDATE editorial_items SET metadata = $2::jsonb, updated_at = now() WHERE id = $1`,
      [item.id, JSON.stringify(metadata)],
    );
    const contentHash = createHash("sha256").update(`${content.title_th}\n${content.body_th}`).digest("hex");
    await tx.query(
      `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'editorial_content_completed', 'automation_run', $2, $3::jsonb)`,
      [auth.ok ? auth.session.userId : null, run.id, JSON.stringify({ editorial_item_id: item.id, source_id: item.source_id, content_hash: contentHash, source_url: content.source_url, source_title: content.source_title, publisher: content.publisher, news_type: content.news_type })],
    );
    return { status: 200 as const, body: { ok: true, run_id: run.id, editorial_item_id: item.id, source_id: item.source_id, status: run.status, content_saved: true } };
  });

  return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
