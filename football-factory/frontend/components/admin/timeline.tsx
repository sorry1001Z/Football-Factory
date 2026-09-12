"use client";

// Football Factory — Admin detail client component (R2 Wave 2C).
//
// Loads:
//   - GET /api/admin/editorial/{id}/audit-events
// Then renders the timeline.
//
// Server-side: the parent page passes the initial editorial item.

import { useEffect, useState, useCallback, useTransition } from "react";
import type { AuditEvent } from "@/lib/admin/contracts";

export function AdminTimeline({ editorialItemId }: { editorialItemId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/admin/editorial/${editorialItemId}/audit-events`,
        { credentials: "same-origin", cache: "no-store" },
      );
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
      const body = (await r.json()) as { items: AuditEvent[] };
      setEvents(body.items ?? []);
    } catch {
      setError("network");
    } finally {
      setLoading(false);
    }
  }, [editorialItemId]);

  useEffect(() => {
    startTransition(() => {
      void reload();
    });
  }, [reload]);

  if (error === "unauthenticated") {
    return (
      <p role="alert" className="admin-error">
        Not signed in. Sign in as admin/editor to view the timeline.
      </p>
    );
  }
  if (error === "not_found") {
    return (
      <p role="alert" className="admin-error">
        Editorial item not found.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="admin-error">
        Failed to load timeline: {error}.
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="admin-empty">
        {loading ? "Loading…" : "No audit events yet."}
      </p>
    );
  }
  return (
    <ol className="admin-timeline" aria-label="Audit timeline">
      {events.map((ev) => (
        <li key={ev.id} className="admin-timeline-item">
          <time className="admin-timeline-time" dateTime={ev.at}>
            {ev.at}
          </time>
          <span className={`admin-badge action-${ev.action}`}>{ev.action}</span>
          <span className="admin-timeline-summary">{ev.summary}</span>
          {ev.actor ? (
            <span className="admin-timeline-actor">by {ev.actor}</span>
          ) : null}
          {Object.keys(ev.metadataSafe).length > 0 ? (
            <details className="admin-timeline-details">
              <summary>metadata</summary>
              <pre>{JSON.stringify(ev.metadataSafe, null, 2)}</pre>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
