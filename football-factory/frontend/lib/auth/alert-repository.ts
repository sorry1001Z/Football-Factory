// Football Factory — alert repository.
//
// Persists automation alerts into the existing `analytics_events` table
// (with event_name='automation_alert') so we don't introduce a new
// table. Severity, source, and message live in `properties`.
//
// This slice ONLY persists. External delivery (Telegram/Slack/Email)
// is a follow-up slice.

import "server-only";

import type { Db } from "@/lib/db/postgres";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export type AutomationAlert = {
  severity: AlertSeverity;
  source: string;
  message: string;
  context: unknown;
  run_id: string | null;
};

export class AlertRepository {
  constructor(private db: Db) {}

  async insert(alert: AutomationAlert): Promise<{ id: number }> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO analytics_events
         (event_name, user_id, path, properties)
       VALUES
         ('automation_alert', NULL, $1, $2::jsonb)
       RETURNING id`,
      [
        alert.source,
        JSON.stringify({
          severity: alert.severity,
          message: alert.message,
          context: alert.context,
          run_id: alert.run_id,
        }),
      ],
    );
    const x = r.rows[0];
    if (!x) throw new Error("alert_insert_failed");
    return x;
  }
}
