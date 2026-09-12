// Football Factory — /admin/editorial queue page (R2 Wave 2C).
//
// Server-rendered shell; the queue is client-driven.

import "server-only";
import { AdminShellHeader } from "@/components/admin/shell-header";
import { AdminQueue } from "@/components/admin/queue";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";
import type { EditorialListResponse } from "@/lib/admin/contracts";

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

export default async function AdminEditorialPage() {
  const initial = await loadInitial();
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/editorial" />
      <main className="admin-shell-main">
        <h1>Editorial queue</h1>
        {initial ? (
          <AdminQueue initial={initial} />
        ) : (
          <p role="alert" className="admin-error">
            Could not load the queue. Sign in as admin/editor first.
          </p>
        )}
      </main>
    </div>
  );
}
