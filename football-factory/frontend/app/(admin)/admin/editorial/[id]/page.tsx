// Football Factory — /admin/editorial/[id] detail page (R2 Wave 2C).
//
// SSR pattern (force-dynamic + Suspense): the outer page is a SYNC
// Server Component; the async DB lookup + UUID validation is moved
// into AdminEditorialDetailLoader and wrapped in <Suspense> with a
// minimal fallback so the App Router doesn't trip on top-level await.

import "server-only";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminShellHeader } from "@/components/admin/shell-header";
import { AdminDetail } from "@/components/admin/detail";
import { AdminResumePipeline } from "@/components/admin/resume-pipeline";
import { AdminEditorialCompletion } from "@/components/admin/editorial-completion";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editorial item · Admin · Football Factory",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AdminDetailFallback() {
  return (
    <p className="admin-empty" aria-live="polite">
      Loading editorial item…
    </p>
  );
}

async function AdminEditorialDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }
  let item;
  try {
    const repo = new EditorialRepository(getDb());
    item = await repo.findById(id);
  } catch {
    item = null;
  }
  if (!item) {
    notFound();
  }
  const runResult = await getDb().query<{
    id: string;
    status: string;
    stage: string | null;
    output: unknown;
    input: unknown;
  }>(
    `SELECT id, status, stage, output, input FROM automation_runs
      WHERE editorial_item_id = $1
      ORDER BY CASE WHEN status = 'held_for_content' THEN 0 ELSE 1 END, started_at DESC
      LIMIT 1`,
    [item.id],
  );
  const run = runResult.rows[0] ?? null;
  return (
    <>
      <AdminDetail item={item} />
      <AdminEditorialCompletion item={item} run={run} />
      {/* Phase 17C: resume controls target the existing editorial item.
          No new editorial_item is created here. */}
      {run?.status === "held_for_content" || run?.status === "recovery_queued"
        ? null
        : <AdminResumePipeline item={item} />}
      {/* Wave D: link to the read-only SEO suggestions panel. */}
      <p>
        <a href={`/admin/editorial/${id}/seo-suggestions`}>
          View SEO suggestions (read-only)
        </a>
      </p>
    </>
  );
}

export default function AdminEditorialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Pass the param Promise straight through into the async loader
  // (which awaits it inside its own context). The outer component
  // stays synchronous; the Suspense boundary streams the fallback
  // first, then the resolved loader output.
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/editorial" />
      <main className="admin-shell-main">
        <Suspense fallback={<AdminDetailFallback />}>
          <AdminEditorialDetailLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}
