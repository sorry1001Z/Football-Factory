// /api/automation/wp-draft (FIRST SLICE)
//
// Auth:    x-automation-secret
// Body:    { run_id, title, content, categories?, tags?, featured_media? }
//
// Behavior:
//   - Verifies run_id exists (created via /api/automation/deduplicate).
//   - Creates a WordPress draft via the write client (NEVER publish).
//   - Updates automation_runs.status to 'waiting_approval' on success.
//   - On failure: status='failed', error=message, returns 502.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readCappedBody } from "@/lib/security/body-cap";
import { verifyAutomationSecret, authRejectResponse } from "@/lib/automation/auth";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";

export const dynamic = "force-dynamic";

const WpDraftSchema = z.object({
  run_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  content: z.string().min(1).max(1_000_000),
  categories: z.array(z.number().int().positive()).max(50).optional(),
  tags: z.array(z.number().int().positive()).max(100).optional(),
  featured_media: z.number().int().positive().optional(),
  // Optional: link this run to an editorial_items row so the publish
  // path can verify approval state. When NULL, wp-publish will refuse
  // to publish with `editorial_link_missing`.
  editorial_item_id: z.string().uuid().optional(),
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
  const v = WpDraftSchema.safeParse(parsed);
  if (!v.success) {
    return NextResponse.json({ ok: false, error: "validation_failed" }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "database_not_configured" },
      { status: 503 },
    );
  }
  const runs = new AutomationRunRepository(getDb());
  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }

  const wp = new WordPressWriteClient();
  if (!wp.configured) {
    await runs.setStatus(v.data.run_id, "failed", undefined, "wp_write_not_configured");
    return NextResponse.json(
      { ok: false, error: "wp_write_not_configured" },
      { status: 503 },
    );
  }

  try {
    const post = await wp.createPost({
      title: v.data.title,
      content: v.data.content,
      status: "draft",
      categories: v.data.categories,
      tags: v.data.tags,
      featured_media: v.data.featured_media,
    });
    await runs.setStatus(v.data.run_id, "waiting_approval", { wp_post_id: post.id });
    // If caller provided editorial_item_id, persist it on the run so the
    // publish path can verify approval state. Best-effort: a failure
    // here must NOT roll back the draft creation. We surface the error
    // in the response payload but still return 201 for the draft.
    let editorialLinkError: string | null = null;
    if (v.data.editorial_item_id) {
      try {
        await getDb().query(
          `UPDATE automation_runs
              SET editorial_item_id = $2
            WHERE id = $1`,
          [v.data.run_id, v.data.editorial_item_id],
        );
      } catch (e) {
        editorialLinkError = (e as Error)?.message ?? "editorial_link_failed";
      }
    }
    return NextResponse.json(
      {
        ok: true,
        run_id: v.data.run_id,
        wp_post_id: post.id,
        status: "draft",
        ...(editorialLinkError ? { editorial_link_warning: editorialLinkError } : {}),
      },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof WordPressWriteError ? e.kind : "wp_error";
    await runs.setStatus(v.data.run_id, "failed", undefined, msg);
    if (e instanceof WordPressWriteError) {
      return NextResponse.json({ ok: false, error: e.kind }, { status: 502 });
    }
    throw e;
  }
}
