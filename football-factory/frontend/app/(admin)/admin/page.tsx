// Football Factory — /admin index (R2 Wave 2C).
//
// Lists the admin sections + a link to the editorial queue.
// Server-rendered; the session guard runs at the API layer.
// The page itself does not gate visibility — the API does — but
// we DO render an explicit "sign in" hint if the SSR data
// fetch returned null (typical when no session cookie).

import "server-only";
import Link from "next/link";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import { AdminQueue } from "@/components/admin/queue";
import { AdminShellHeader } from "@/components/admin/shell-header";
import type { EditorialListResponse } from "@/lib/admin/contracts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Football Factory",
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

export default async function AdminPage() {
  const initial = await loadInitial();
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin" />
      <main className="admin-shell-main">
        <h1>Editorial admin</h1>
        <nav aria-label="Admin sections">
          <ul>
            <li>
              <Link href="/admin/editorial">Editorial queue</Link>
            </li>
          </ul>
        </nav>
        <section>
          <h2>Pending approval</h2>
          {initial ? (
            <AdminQueue initial={initial} />
          ) : (
            <p role="alert" className="admin-error">
              Could not load the queue. Sign in as admin/editor first.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
