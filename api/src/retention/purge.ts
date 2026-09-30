import { db, tx } from "../lib/db.js";
import { optionalInt } from "../lib/config.js";
import type { Logger } from "../lib/log.js";

export interface PurgeReport { calls: number; bookings: number; messages: number; transfers: number; queuedVapiDeletes: number; housekeeping: number }

export async function purgeExpired(log: Logger): Promise<PurgeReport> {
  const days = optionalInt("RETENTION_DAYS", 30);
  const report = await tx(async (c) => {
    const calls = await c.query<{ id: string; vapi_deleted_at: Date | null }>(
      "DELETE FROM calls WHERE started_at < now() - make_interval(days => $1) RETURNING id, vapi_deleted_at",
      [days],
    );
    const orphanIds = calls.rows.filter((r) => !r.vapi_deleted_at).map((r) => r.id);
    let queued = 0;
    if (orphanIds.length) {
      const q = await c.query(
        `INSERT INTO vapi_deletions (call_id) SELECT unnest($1::text[])
         ON CONFLICT (call_id) DO UPDATE SET next_attempt_at = LEAST(vapi_deletions.next_attempt_at, now())
         WHERE vapi_deletions.confirmed_at IS NULL`,
        [orphanIds],
      );
      queued = q.rowCount ?? 0;
    }
    const cutoff = "now() - make_interval(days => $1)";
    const bookings = await c.query(`DELETE FROM bookings WHERE created_at < ${cutoff}`, [days]);
    const messages = await c.query(`DELETE FROM messages WHERE created_at < ${cutoff}`, [days]);
    const transfers = await c.query(`DELETE FROM transfers WHERE created_at < ${cutoff}`, [days]);

    let housekeeping = 0;
    for (const sql of [
      "DELETE FROM call_events WHERE received_at < now() - interval '2 days'",
      "DELETE FROM tool_calls WHERE updated_at < now() - interval '1 day'",
      "DELETE FROM tool_call_results WHERE created_at < now() - interval '1 day'",
      "DELETE FROM sessions WHERE last_seen_at < now() - interval '8 hours' OR created_at < now() - interval '7 days'",
      "DELETE FROM login_attempts WHERE window_start < now() - interval '24 hours'",
      "DELETE FROM password_tokens WHERE expires_at < now() - interval '7 days' OR used_at < now() - interval '7 days'",
      "DELETE FROM invites WHERE expires_at < now() - interval '7 days' OR used_at < now() - interval '7 days'",
      "DELETE FROM audit_log WHERE at < now() - interval '1 year'",
      "DELETE FROM scrape_runs WHERE started_at < now() - interval '90 days'",
      "DELETE FROM vapi_deletions WHERE confirmed_at < now() - interval '30 days'",
    ]) {
      housekeeping += (await c.query(sql)).rowCount ?? 0;
    }
    return {
      calls: calls.rowCount ?? 0,
      bookings: bookings.rowCount ?? 0,
      messages: messages.rowCount ?? 0,
      transfers: transfers.rowCount ?? 0,
      queuedVapiDeletes: queued,
      housekeeping,
    };
  });
  log.info("Retention purge complete", { ...report });
  return report;
}
