// Football Factory — automation log repository.
//
// Persists structured automation events into the existing `audit_logs`
// table. The log endpoint accepts events from n8n (or any automation
// caller) and stores them durably. No new table is introduced; the
// existing audit_logs schema already covers it.
//
// Secret-redaction is enforced at the route layer; this repository
// trusts that the route has already scrubbed the metadata before insert.

import "server-only";

import type { Db } from "@/lib/db/postgres";

export type AutomationLogEntry = {
  run_id: string | null;
  action: string;            // e.g. "dedupe", "wp_draft", "wp_publish", "approval_decision"
  stage: string;             // e.g. "ingested", "drafted", "approved", "published"
  status: string;            // e.g. "running", "success", "failed", "waiting_approval", "rejected"
  message: string | null;
  metadata: unknown;
  request_id: string | null;
  ip_hash: string | null;
};

export class AutomationLogRepository {
  constructor(private db: Db) {}

  async insert(entry: AutomationLogEntry): Promise<{ id: number }> {
    const r = await this.db.query<{ id: number }>(
      `INSERT INTO audit_logs
         (actor_user_id, action, resource_type, resource_id,
          request_id, ip_hash, metadata)
       VALUES
         (NULL, $1, 'automation_run', $2,
          $3, $4, $5::jsonb)
       RETURNING id`,
      [
        entry.action,
        entry.run_id,
        entry.request_id,
        entry.ip_hash,
        JSON.stringify({
          stage: entry.stage,
          status: entry.status,
          message: entry.message,
          metadata: entry.metadata,
        }),
      ],
    );
    const x = r.rows[0];
    if (!x) throw new Error("automation_log_insert_failed");
    return x;
  }
}
