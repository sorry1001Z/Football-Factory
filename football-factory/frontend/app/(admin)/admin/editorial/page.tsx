// Football Factory — /admin/editorial queue page (R2 Wave 2C).
//
// Server-rendered shell; the queue is client-driven.
//
// SSR pattern (force-dynamic + Suspense): see app/(admin)/admin/page.tsx.

import "server-only";
import { Suspense } from "react";
import Link from "next/link";
import { AdminShellHeader } from "@/components/admin/shell-header";
import { AdminQueue } from "@/components/admin/queue";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import type { EditorialListResponse } from "@/lib/admin/contracts";

type HeldEditorialRun = {
  run_id: string;
  editorial_item_id: string;
  source_id: string;
  source_url: string | null;
  source_title: string | null;
  updated_at: string;
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editorial queue · Admin · Football Factory",
  robots: { index: false, follow: false },
};

async function loadInitial(): Promise<EditorialListResponse | null> {
  try {
    const repo = new EditorialRepository(getDb());
    const { items, total } = await repo.listFiltered({
      stage: null,
      approvalState: "pending",
      searchFragment: null,
      sortKey: "updated_at_desc",
      limit: 25,
      offset: 0,
    });
    return {
      ok: true,
      items,
      total,
      page: 1,
      pageSize: 25,
      sort: "updated_at_desc",
      filters: {
        stage: null,
        approvalState: "pending",
        rights: null,
        fact: null,
        search: null,
      },
    };
  } catch {
    return null;
  }
}

async function loadHeldRuns(): Promise<HeldEditorialRun[]> {
  try {
    const result = await getDb().query<HeldEditorialRun>(
      `SELECT run.id AS run_id, item.id AS editorial_item_id, item.source_id,
              COALESCE(item.metadata->>'source_url', run.input->>'source_url') AS source_url,
              COALESCE(item.metadata->>'source_title', item.metadata->>'title', run.input->>'source_title') AS source_title,
              run.updated_at
         FROM automation_runs run
         JOIN editorial_items item ON item.id = run.editorial_item_id
        WHERE run.status = 'held_for_content'
        ORDER BY run.updated_at DESC LIMIT 50`,
    );
    return result.rows;
  } catch {
    return [];
  }
}

function AdminEditorialQueueFallback() {
  return (
    <p className="admin-empty" aria-live="polite">
      Loading queue…
    </p>
  );
}

async function AdminEditorialPageLoader() {
  const [initial, heldRuns] = await Promise.all([loadInitial(), loadHeldRuns()]);
  return initial ? (
    <>
      <section aria-labelledby="held-editorial-heading" data-testid="held-editorial-queue">
        <h2 id="held-editorial-heading">Needs editorial content</h2>
        {heldRuns.length === 0 ? <p>No runs currently held for content.</p> : (
          <ul>
            {heldRuns.map((run) => (
              <li key={run.run_id}>
                <Link href={`/admin/editorial/${run.editorial_item_id}`}>
                  {run.source_title || run.source_id}
                </Link>
                {run.source_url?.startsWith("https://") ? <>
                  {" — "}<a href={run.source_url} target="_blank" rel="noopener noreferrer">Open source</a>
                </> : null}
                {" — run "}<code>{run.run_id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AdminQueue initial={initial} />
    </>
  ) : (
    <p role="alert" className="admin-error">
      Could not load the queue. Sign in as admin/editor first.
    </p>
  );
}

export default function AdminEditorialPage() {
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/editorial" />
      <main className="admin-shell-main">
        <h1>Editorial queue</h1>
        <p>
          <Link href="/admin/editorial/new" data-testid="admin-new-pilot-link">
            New Editorial Pilot (operator-driven)
          </Link>
        </p>
        <Suspense fallback={<AdminEditorialQueueFallback />}>
          <AdminEditorialPageLoader />
        </Suspense>
      </main>
    </div>
  );
}
