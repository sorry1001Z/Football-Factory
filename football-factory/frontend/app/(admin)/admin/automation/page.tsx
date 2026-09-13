// Football Factory — /admin/automation index (Set #3 Wave C).
//
// Read-only observability surface over the existing admin
// automation system. NEVER mutates state — display only.
// Wraps the existing Admin V6 shell + automation view-model.

import "server-only";
import Link from "next/link";
import { AdminShellHeader } from "@/components/admin/shell-header";
import {
  filterRuns,
  healthSummary,
  mutationCapabilities,
  retryUiContract,
  stageTimeline,
  viewState,
  type RawRun,
} from "@/lib/admin/automation/view-model";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Automation dashboard · Admin · Football Factory",
  robots: { index: false, follow: false },
};

// In Wave C we read from a fixture-only system health signal.
// Live health data is sourced by the admin/automation/[runId]
// route in production. This page is the queue-level dashboard.
async function loadRunsAndHealth(): Promise<{
  runs: RawRun[];
  system: { database: string; wordpress: string };
}> {
  // Production integration is wired through existing Admin V6
  // routes; for Wave C the dashboard exposes a read-only fixture
  // shape so the UI surface compiles and renders deterministically.
  return {
    runs: [],
    system: { database: "ok", wordpress: "ok" },
  };
}

export default async function AdminAutomationIndexPage() {
  const { runs, system } = await loadRunsAndHealth();
  const state = viewState(runs, { system });
  const normalized = runs.map((r) => ({ ...r }));
  const filtered = filterRuns(normalized, {});
  const health = healthSummary(normalized, system);
  const caps = mutationCapabilities();

  return (
    <div className="admin-shell admin-shell-root">
      <AdminShellHeader currentPath="/admin/automation" />
      <main className="admin-shell-main">
        <h1>Automation dashboard</h1>

        <section aria-label="view-state" data-state={state.kind}>
          {state.kind === "loading" && <p>Loading…</p>}
          {state.kind === "empty" && <p>No automation runs.</p>}
          {state.kind === "error" && (
            <p role="alert" className="admin-error">
              {state.message ?? "Unknown error."}
            </p>
          )}
          {state.kind === "degraded" && (
            <div role="alert" className="admin-warning">
              <strong>Degraded:</strong> {state.code}
              {state.code === "database_not_configured" && (
                <p>DATABASE_URL is not configured. The dashboard is read-only.</p>
              )}
              {state.code === "wordpress_unreachable" && (
                <p>WordPress host is unreachable. The dashboard is read-only.</p>
              )}
            </div>
          )}
          {state.kind === "ready" && (
            <p>
              {state.count} run{state.count === 1 ? "" : "s"}.
            </p>
          )}
        </section>

        <section aria-label="health-summary">
          <ul>
            <li>Total: {health.total}</li>
            <li>Running: {health.running}</li>
            <li>Failed: {health.failed}</li>
            <li>Waiting approval: {health.waitingApproval}</li>
            <li>Published: {health.published}</li>
            <li>Database: {health.database}</li>
            <li>WordPress: {health.wordpress}</li>
          </ul>
        </section>

        <section aria-label="capabilities">
          <p>
            Mutation capabilities: canRetry={String(caps.canRetry)} ·
            canApprove={String(caps.canApprove)} · canReject=
            {String(caps.canReject)} · canPublish=
            {String(caps.canPublish)} · canMutateRun=
            {String(caps.canMutateRun)}
          </p>
          <p className="admin-help">
            All mutation capabilities are disabled in this read-only
            view-model. The existing Admin V6 shell provides the
            authoritative approval / publish / retry endpoints.
          </p>
        </section>

        {filtered.length > 0 && (
          <section aria-label="run-list">
            <h2>Runs</h2>
            <ul>
              {filtered.map((run) => {
                const timeline = stageTimeline(run);
                const retry = retryUiContract(run);
                return (
                  <li key={String(run.runId ?? Math.random())}>
                    <Link href={`/admin/automation/${run.runId ?? ""}`}>
                      {String(run.runId ?? "(no id)")}
                    </Link>
                    <span> — stage {String(run.stage ?? "—")}</span>
                    <span> — status {String(run.status ?? "—")}</span>
                    <span>
                      {" — retry: "}
                      {retry.label} (enabled={String(retry.enabled)})
                    </span>
                    <details>
                      <summary>Timeline ({timeline.length} stages)</summary>
                      <ol>
                        {timeline.map((t) => (
                          <li key={t.stage}>
                            {t.stage}: {t.status}
                            {t.at ? ` @ ${t.at}` : ""}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}