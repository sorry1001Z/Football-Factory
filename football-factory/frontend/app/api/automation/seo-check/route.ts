// /api/automation/seo-check  (PRE-N8N BACKEND — FF_HOOK_7)
//
// Auth:    x-automation-secret
// Body:    { run_id, editorial_item_id, title, content, slug?, description? }
//
// Behavior:
//   - Verify run <-> editorial association.
//   - Run LOCAL DETERMINISTIC checks (no fabricated ranking scores):
//       title_present
//       description_present  (from body.description OR first 200 chars of content)
//       slug_shape           (lowercase a-z0-9-, length 3..64)
//       content_length_chars (>= 200 baseline)
//       internal_links_count (rough regex)
//   - Persist stage=seo_check + seo_score (computed) + metadata.seo_check.
//   - provider_status = "not_configured" (no deeper SEO provider wired).
//   - Audit log + idempotency on (title, content) hash.

import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
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

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const Hook7Schema = z.object({
  run_id: z.string().uuid(),
  editorial_item_id: z.string().uuid(),
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

function inputHash(input: { title: string; content: string; slug?: string; description?: string }): string {
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
  // score 0..100 = (passed checks / total checks) * 100
  checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
}

function runLocalSeoChecks(input: {
  title: string;
  content: string;
  slug?: string;
  description?: string;
}): {
  result: LocalSeo;
  score: number;
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const checks: LocalSeo["checks"] = [];

  // title_present: 1..200 (extended range)
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

  // description_present: derived from body.description or first 200 chars
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

  // slug_shape (optional but recommended)
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
      const ok = SLUG_RE.test(input.slug) && input.slug.length >= 3 && input.slug.length <= 64;
      checks.push({
        id: "slug_shape",
        label: "Slug is a-z, 0-9, dashes (3..64)",
        passed: ok,
        detail: `slug=${input.slug}`,
      });
      if (!ok) issues.push("invalid_slug");
    }
  }

  // content_length_chars >= 200 baseline
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

  // canonical_candidate_ok: derived from slug or title
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

  // internal_links_count: rough "href=\"/..." pattern
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
  const passed = checks.filter((c) => c.passed).length;
  const score = total === 0 ? 0 : Math.round((passed / total) * 100);

  return {
    result: { issues, recommendations, checks },
    score,
  };
}

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
  const v = Hook7Schema.safeParse(parsed);
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

  const run = await runs.get(v.data.run_id);
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 });
  }
  const item = await items.findById(v.data.editorial_item_id);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "editorial_item_not_found" },
      { status: 404 },
    );
  }
  const linkedItem = await items.findByRunId(v.data.run_id);
  if (!linkedItem || linkedItem.id !== v.data.editorial_item_id) {
    return NextResponse.json(
      { ok: false, error: "association_mismatch" },
      { status: 409 },
    );
  }

  const providerConfigured = Boolean(process.env.SEO_PROVIDER_URL);
  const providerStatus: "configured" | "not_configured" = providerConfigured
    ? "configured"
    : "not_configured";

  const h = inputHash({
    title: v.data.title,
    content: v.data.content,
    slug: v.data.slug,
    description: v.data.description,
  });
  const meta = (item.metadata as Record<string, unknown> | null) ?? {};
  const prevS = (meta.seo_check as { hash?: string; last_at?: string; score?: number } | undefined) ?? undefined;
  if (prevS?.hash === h) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      provider_status: providerStatus,
      input_hash: h,
      score: prevS.score ?? 0,
      run_id: v.data.run_id,
      editorial_item_id: item.id,
      stage: item.stage,
    });
  }

  await items.setStage(item.id, "seo_check", v.data.run_id, "FF_HOOK_7");

  const { result, score } = runLocalSeoChecks({
    title: v.data.title,
    content: v.data.content,
    slug: v.data.slug,
    description: v.data.description,
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
                                 'last_at', to_jsonb(now())
                               )
                             ),
            seo_score = $7::int
      WHERE id = $1`,
    [
      item.id,
      providerStatus,
      h,
      JSON.stringify(result.checks),
      JSON.stringify(result.issues),
      JSON.stringify(result.recommendations),
      score,
    ],
  );

  await logs.insert({
    run_id: v.data.run_id,
    action: "editorial_seo_check_completed",
    stage: "seo_check",
    status: "ok",
    message: `FF_HOOK_7 provider=${providerStatus} score=${score}`,
    metadata: redactSecrets({
      editorial_item_id: item.id,
      provider_status: providerStatus,
      input_hash: h,
      score,
      issues: result.issues,
    }) as Record<string, unknown>,
  request_id: null,
    ip_hash: null,
  });

  return NextResponse.json({
    ok: true,
    idempotent: false,
    provider_status: providerStatus,
    input_hash: h,
    score,
    checks: result.checks,
    issues: result.issues,
    recommendations: result.recommendations,
    run_id: v.data.run_id,
    editorial_item_id: item.id,
    stage: "seo_check",
  });
}
