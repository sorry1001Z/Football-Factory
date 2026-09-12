"use client";

// Football Factory — Admin automation-run client (R2 Wave 2C).

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import type { AutomationRunResponse } from "@/lib/admin/contracts";
import { AdminTimeline } from "./timeline";

export function AdminRun({ runId }: { runId: string }) {
  const [data, setData] = useState<AutomationRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/automation/${runId}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 401) {
        setError("unauthenticated");
        return;
      }
      if (r.status === 404) {
        setError("not_found");
        return;
      }
      if (!r.ok) {
        setError(`http_${r.status}`);
        return;
      }
      const body = (await r.json()) as AutomationRunResponse;
      setData(body);
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, [reload]);

  if (error === "unauthenticated") {
    return (
      <p role="alert" className="admin-error">
        Not signed in. Sign in as admin/editor to view this run.
      </p>
    );
  }
  if (error === "not_found") {
    return (
      <p role="alert" className="admin-error">
        Run not found.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="admin-error">
        Failed to load run: {error}.
      </p>
    );
  }
  if (!data) {
    return <p className="admin-empty">{loading ? "Loading…" : "Loading run…"}</p>;
  }
  const run = data.run;
  const item = data.editorialItem;
  return (
    <div className="admin-shell admin-run">
      <header className="admin-detail-header">
        <h1>Run {run.id}</h1>
        <dl>
          <dt>Workflow</dt>
          <dd>{run.workflow}</dd>
          <dt>Status</dt>
          <dd>
            <span className={`admin-badge status-${run.status}`}>
              {run.status}
            </span>
          </dd>
          <dt>Stage</dt>
          <dd>{run.stage}</dd>
          <dt>Error class</dt>
          <dd>{run.errorClass}</dd>
          <dt>WP Post ID</dt>
          <dd>{run.wpPostId ?? "—"}</dd>
          <dt>Created</dt>
          <dd>
            <time dateTime={run.createdAt}>{run.createdAt}</time>
          </dd>
          <dt>Updated</dt>
          <dd>
            <time dateTime={run.updatedAt}>{run.updatedAt}</time>
          </dd>
          {item ? (
            <>
              <dt>Editorial item</dt>
              <dd>
                <Link href={`/admin/editorial/${item.id}`}>{item.id}</Link>
              </dd>
            </>
          ) : (
            <>
              <dt>Editorial item</dt>
              <dd>(no link)</dd>
            </>
          )}
        </dl>
      </header>
      <section>
        <h2>Recent events</h2>
        {item ? (
          <AdminTimeline editorialItemId={item.id} />
        ) : (
          <p className="admin-empty">No linked editorial item.</p>
        )}
      </section>
    </div>
  );
}
