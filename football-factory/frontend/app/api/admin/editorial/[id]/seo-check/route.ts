// Football Factory — POST /api/admin/editorial/[id]/seo-check
//
// Admin-session equivalent of /api/automation/seo-check.
//
// Auth:    admin/editor session (cookie)
// CSRF:    required
// Body:    { run_id, title, content, slug?, description?, candidate_url? }
//
// Behavior:
//   - Verify run.editorial_item_id == [id].
//   - Run LOCAL DETERMINISTIC checks (no fabricated ranking scores):
//       title_present, description_present, slug_shape, content_length,
//       canonical_candidate_ok, internal_links_present
//   - Persist stage=seo_check + seo_score + metadata.seo_check.
//   - Audit log + idempotency on (title, content, slug, description) hash.

import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import {
  runPipelineStep,
  resultToResponse,
  type PipelineSession,
} from "@/lib/admin/pipeline-runner";
import { getDb } from "@/lib/db/postgres";
import { AutomationRunRepository } from "@/lib/auth/repositories";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AutomationLogRepository } from "@/lib/auth/automation-log-repository";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const Schema = z.object({
  run_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  content: z.string().min(1).max(1_000_000),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(SLUG_RE, "slug must be lowercase a-z, 0-9, dashes only")
    .optional(),
  description: z.string().trim().max(500).optional(),
  candidate_url: z.string().trim().max(2048).optional(),
});

function inputHash(input: {
  title: string;
  content: string;
  slug?: string;
  description?: string;
}): string {
  const s = JSON.stringify({
    title: input.title,
    content: input.content,
    slug: input.slug ?? null,
    description: input.description ?? null,
  });
  return crypto.createHash("sha256").update(s, "utf-8").digest("hex").slice(0, 32);
}

interface LocalSeo {
  issues: string[];
  recommendations: string[];
  checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
}

function runLocalSeoChecks(input: {
  title: string;
  content: string;
  slug?: string;
  description?: string;
}): { result: LocalSeo; score: number } {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const checks: LocalSeo["checks"] = [];

  // title_present
  {
    const len = input.title.trim().length;
    const passed = len >= 1 && len <= 200;
    checks.push({
      id: "title_present",
      label: "Title is present and ≤200 chars",
      passed,
      detail: `length=${len}`,
    });
    if (!passed) issues.push("title_missing_or_too_long");
    if (len === 0) recommendations.push("Provide a non-empty title");
    if (len > 200) recommendations.push("Shorten title to ≤200 chars");
  }

  // description_present
  let desc = (input.description ?? "").trim();
  if (!desc) desc = input.content.replace(/\s+/g, " ").trim().slice(0, 200);
  {
    const passed = desc.length >= 50 && desc.length <= 200;
    checks.push({
      id: "description_present",
      label: "Description is 50..200 chars",
      passed,
      detail: `length=${desc.length}`,
    });
    if (!passed) {
      issues.push("description_too_short_or_long");
      recommendations.push(
        "Provide a description 50..200 chars (or write content whose first paragraph can serve as one)",
      );
    }
  }

  // slug_shape
  {
    if (!input.slug) {
      checks.push({
        id: "slug_shape",
        label: "Slug is a-z, 0-9, dashes (3..64)",
        passed: false,
        detail: "no slug supplied",
      });
      recommendations.push("Provide a slug (a-z, 0-9, dashes)");
    } else {
      const ok =
        SLUG_RE.test(input.slug) && input.slug.length >= 3 && input.slug.length <= 64;
      checks.push({
        id: "slug_shape",
        label: "Slug is a-z, 0-9, dashes (3..64)",
        passed: ok,
        detail: `slug=${input.slug}`,
      });
      if (!ok) issues.push("invalid_slug");
    }
  }

  // content_length
  {
    const len = input.content.length;
    const passed = len >= 200;
    checks.push({
      id: "content_length",
      label: "Content length ≥ 200 chars",
      passed,
      detail: `length=${len}`,
    });
    if (!passed) {
      issues.push("content_too_short");
      recommendations.push("Add more content (≥200 chars)");
    }
  }

  // canonical_candidate_ok
  {
    const candidate = (input.slug ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 64);
    const passed = SLUG_RE.test(candidate) && candidate.length >= 3;
    checks.push({
      id: "canonical_candidate_ok",
      label: "Has a valid canonical slug candidate",
      passed,
      detail: `candidate=${candidate}`,
    });
    if (!passed) recommendations.push("Generate a stable canonical slug");
  }

  // internal_links_present
  {
    const matches = input.content.match(/href=["']\/[^"'#?]+/g) ?? [];
    const passed = matches.length >= 1;
    checks.push({
      id: "internal_links_present",
      label: "Contains ≥1 internal link (href=\"/...\")",
      passed,
      detail: `count=${matches.length}`,
    });
    if (!passed) recommendations.push("Add at least one internal link");
  }

  const total = checks.length;
  const passedCount = checks.filter((c) => c.passed).length;
  const score = total === 0 ? 0 : Math.round((passedCount / total) * 100);

  return {
    result: { issues, recommendations, checks },
    score,
  };
}

async function runner(
  body: z.infer<typeof Schema>,
  session: PipelineSession,
  editorialItemId: string,
) {
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

  const run = await runs.get(body.run_id);
  if (!run) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "run_not_found",
    };
  }
  if (run.editorial_item_id !== editorialItemId) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "association_mismatch",
    };
  }
  const item = await items.findById(editorialItemId);
  if (!item) {
    return {
      ok: false as const,
      status: 404 as const,
      error: "editorial_item_not_found",
    };
  }

  const providerConfigured = Boolean(process.env.SEO_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  const h = inputHash({
    title: body.title,
    content: body.content,
    slug: body.slug,
    description: body.description,
  });
  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevS = (meta.seo_check as { hash?: string; last_at?: string; score?: number } | undefined) ?? undefined;
  if (prevS?.hash === h) {
    return {
      ok: true as const,
      status: 200 as const,
      body: {
        ok: true,
        idempotent: true,
        provider_status: providerStatus,
        input_hash: h,
        score: prevS.score ?? 0,
        run_id: body.run_id,
        editorial_item_id: item.id,
        stage: item.stage,
      },
    };
  }

  await items.setStage(item.id, "seo_check", body.run_id, "ADMIN_FF_HOOK_7");

  const { result, score } = runLocalSeoChecks({
    title: body.title,
    content: body.content,
    slug: body.slug,
    description: body.description,
  });

  await db.query(
    `UPDATE editorial_items
        SET metadata = COALESCE(metadata, '{}'::jsonb)
                          || jsonb_build_object(
                               'seo_check',
                               jsonb_build_object(
                                 'provider_status', $2::text,
                                 'input_hash', $3::text,
                                 'checks', $4::jsonb,
                                 'issues', $5::jsonb,
                                 'recommendations', $6::jsonb,
                                 'last_at', to_jsonb(now()),
                                 'actor_user_id', $7::text
                               )
                             ),
            seo_score = $8::int
      WHERE id = $1`,
    [
      item.id,
      providerStatus,
      h,
      JSON.stringify(result.checks),
      JSON.stringify(result.issues),
      JSON.stringify(result.recommendations),
      session.userId,
      score,
    ],
  );

  await logs.insert({
    run_id: body.run_id,
    action: "admin_editorial_seo_check_completed",
    stage: "seo_check",
    status: "ok",
    message: `ADMIN FF_HOOK_7 provider=${providerStatus} score=${score}`,
    metadata: {
      editorial_item_id: item.id,
      provider_status: providerStatus,
      input_hash: h,
      score,
      issues: result.issues,
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
      idempotent: false,
      provider_status: providerStatus,
      input_hash: h,
      score,
      checks: result.checks,
      issues: result.issues,
      recommendations: result.recommendations,
      run_id: body.run_id,
      editorial_item_id: item.id,
      stage: "seo_check",
    },
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: editorialItemId } = await context.params;
  const r = await runPipelineStep(
    request,
    {
      bucket: "seo_check",
      limit: 30,
      windowMs: 60_000,
      schema: Schema,
    },
    async ({ body, session }) => runner(body, session, editorialItemId),
  );
  return resultToResponse(r);
}
