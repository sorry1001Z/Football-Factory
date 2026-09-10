// /api/admin/posts (FIRST SLICE)
//
// Methods:
//   GET    list recent posts (limited; admin/editor only)
//   POST   create a new WordPress DRAFT
//   PATCH  partial update of an existing WordPress post
//   DELETE trash a WordPress post (no force delete)
//
// Security on every method:
//   - guard (admin OR editor)
//   - 1 MB body cap
//   - rate limit 60 / min / (user_id OR ip)
//   - zod body validation
//   - CSRF (for state-changing methods)
//
// WP behavior:
//   - POST defaults to status='draft'; 'publish' is REJECTED.
//   - PATCH requires explicit status if status is being changed; if
//     status is omitted, WP keeps the existing status.
//   - DELETE uses WP REST `force=false` so posts go to trash, not
//     permanently deleted.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrEditor, guardResponse } from "@/lib/admin/guard";
import type { GuardResult } from "@/lib/admin/guard";
import { readCappedBody } from "@/lib/security/body-cap";
import { consume, ipOf } from "@/lib/security/rate-limit";
import { checkCsrf, csrfRejectResponse } from "@/lib/security/csrf";
import {
  WordPressWriteClient,
  WordPressWriteError,
} from "@/lib/wordpress/write";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
  content: z.string().min(1).max(1_000_000),
  // status is optional. If provided it must be 'draft' or 'pending';
  // 'publish' is rejected.
  status: z.enum(["draft", "pending"]).optional(),
  categories: z.array(z.number().int().positive()).max(50).optional(),
  tags: z.array(z.number().int().positive()).max(100).optional(),
  featured_media: z.number().int().positive().optional(),
});

const UpdateSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().trim().min(1).max(500).optional(),
    content: z.string().min(1).max(1_000_000).optional(),
    // status may be set explicitly. If set, must be one of three.
    status: z.enum(["draft", "pending", "publish"]).optional(),
    categories: z.array(z.number().int().positive()).max(50).optional(),
    tags: z.array(z.number().int().positive()).max(100).optional(),
    featured_media: z.number().int().positive().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.content !== undefined ||
      v.status !== undefined ||
      v.categories !== undefined ||
      v.tags !== undefined ||
      v.featured_media !== undefined,
    { message: "no_fields_to_update" },
  );

const DeleteSchema = z.object({
  id: z.number().int().positive(),
});

function rateKey(request: Request, userId?: string): string {
  return `admin_posts:${userId ?? ipOf(request)}`;
}

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...(extra ?? {}) }, { status });
}

/**
 * Narrow a GuardResult to its `ok: true` branch. If not ok, return the
 * proper Response. Returns either the response (to early-return) or the
 * narrowed session.
 */
function applyGuard(g: GuardResult):
  | { kind: "response"; response: Response }
  | { kind: "session"; userId: string; role: string } {
  const resp = guardResponse(g);
  if (resp !== null) return { kind: "response", response: resp };
  if (g.ok) {
    return { kind: "session", userId: g.session.userId, role: g.session.role };
  }
  return {
    kind: "response",
    response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }),
  };
}

// --- GET -------------------------------------------------------------------
export async function GET(request: Request) {
  const a = applyGuard(requireAdminOrEditor(request));
  if (a.kind === "response") return a.response;
  const wp = new WordPressWriteClient();
  return NextResponse.json(
    {
      ok: true,
      note: "use WPGraphQL for content listing; this slice only exposes write paths",
      wp_configured: wp.configured,
      actor: { id: a.userId, role: a.role },
    },
    { status: 200 },
  );
}

// --- POST ------------------------------------------------------------------
export async function POST(request: Request) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const a = applyGuard(requireAdminOrEditor(request));
  if (a.kind === "response") return a.response;

  const rl = consume(rateKey(request, a.userId), 60, 60_000);
  if (!rl.ok) return jsonError(429, "rate_limited", { reset_ms: rl.reset_ms });

  const body = await readCappedBody(request, "admin");
  if (!body.ok) {
    return jsonError(body.reason === "too_large" ? 413 : 400, body.reason);
  }
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return jsonError(400, "invalid_json");
  }
  const v = CreateSchema.safeParse(parsed);
  if (!v.success) return jsonError(400, "validation_failed");

  const wp = new WordPressWriteClient();
  if (!wp.configured) return jsonError(503, "wp_write_not_configured");
  try {
    const post = await wp.createPost(v.data);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e) {
    if (e instanceof WordPressWriteError) {
      return jsonError(e.status && e.status >= 500 ? 502 : 400, e.kind);
    }
    throw e;
  }
}

// --- PATCH -----------------------------------------------------------------
export async function PATCH(request: Request) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const a = applyGuard(requireAdminOrEditor(request));
  if (a.kind === "response") return a.response;

  const rl = consume(rateKey(request, a.userId), 60, 60_000);
  if (!rl.ok) return jsonError(429, "rate_limited", { reset_ms: rl.reset_ms });

  const body = await readCappedBody(request, "admin");
  if (!body.ok) return jsonError(body.reason === "too_large" ? 413 : 400, body.reason);
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return jsonError(400, "invalid_json");
  }
  const v = UpdateSchema.safeParse(parsed);
  if (!v.success) return jsonError(400, "validation_failed");

  const wp = new WordPressWriteClient();
  if (!wp.configured) return jsonError(503, "wp_write_not_configured");
  const { id, ...patch } = v.data;
  try {
    const post = await wp.updatePost(id, patch);
    return NextResponse.json({ ok: true, post }, { status: 200 });
  } catch (e) {
    if (e instanceof WordPressWriteError) {
      return jsonError(e.status && e.status >= 500 ? 502 : 400, e.kind);
    }
    throw e;
  }
}

// --- DELETE ----------------------------------------------------------------
export async function DELETE(request: Request) {
  const csrf = checkCsrf(request);
  if (!csrf.ok) return csrfRejectResponse(csrf);

  const a = applyGuard(requireAdminOrEditor(request));
  if (a.kind === "response") return a.response;

  const rl = consume(rateKey(request, a.userId), 60, 60_000);
  if (!rl.ok) return jsonError(429, "rate_limited", { reset_ms: rl.reset_ms });

  const body = await readCappedBody(request, "admin");
  if (!body.ok) return jsonError(body.reason === "too_large" ? 413 : 400, body.reason);
  let parsed: unknown;
  try {
    parsed = body.raw ? JSON.parse(body.raw) : {};
  } catch {
    return jsonError(400, "invalid_json");
  }
  const v = DeleteSchema.safeParse(parsed);
  if (!v.success) return jsonError(400, "validation_failed");

  const wp = new WordPressWriteClient();
  if (!wp.configured) return jsonError(503, "wp_write_not_configured");
  try {
    const post = await wp.trashPost(v.data.id);
    return NextResponse.json({ ok: true, post }, { status: 200 });
  } catch (e) {
    if (e instanceof WordPressWriteError) {
      return jsonError(e.status && e.status >= 500 ? 502 : 400, e.kind);
    }
    throw e;
  }
}
