// Football Factory — /admin/automation/[runId] page (R2 Wave 2C).

import "server-only";
import { AdminShellHeader } from "@/components/admin/shell-header";
import { AdminRun } from "@/components/admin/run";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Automation run · Admin · Football Factory",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  if (!UUID_RE.test(runId)) {
    return (
      <div className="admin-shell admin-shell-root">
        <AdminShellHeader currentPath="/admin" />
        <main className="admin-shell-main">
          <p role="alert" className="admin-error">
            Invalid run id.
          </p>
        </main>
      </div>
    );
  }
  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin" />
      <main className="admin-shell-main">
        <AdminRun runId={runId} />
      </main>
    </div>
  );
}
