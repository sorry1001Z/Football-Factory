// Football Factory — /admin/editorial/[id] detail page (R2 Wave 2C).

import "server-only";
import { notFound } from "next/navigation";
import { AdminShellHeader } from "@/components/admin/shell-header";
import { AdminDetail } from "@/components/admin/detail";
import { getDb } from "@/lib/db/postgres";
import { EditorialRepository } from "@/lib/auth/editorial-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Editorial item · Admin · Football Factory",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminEditorialDetailPage({
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
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/editorial" />
      <main className="admin-shell-main">
        <AdminDetail item={item} />
      </main>
    </div>
  );
}
