import { db } from "../lib/db.js";
import { errMsg, type Logger } from "../lib/log.js";
import { deleteVapiCall } from "../vapi/client.js";

export async function processVapiDeletions(log: Logger, limit = 50): Promise<{ deleted: number; failed: number }> {
  const due = await db().query<{ call_id: string; attempts: number }>(
    `SELECT call_id, attempts FROM vapi_deletions
      WHERE confirmed_at IS NULL AND next_attempt_at <= now() AND attempts < 30
      ORDER BY next_attempt_at LIMIT $1`,
    [limit],
  );
  let deleted = 0;
  let failed = 0;
  for (const row of due.rows) {
    try {
      await deleteVapiCall(row.call_id);
      await db().query("UPDATE vapi_deletions SET confirmed_at = now(), attempts = attempts + 1, last_error = NULL WHERE call_id = $1", [row.call_id]);
      await db().query("UPDATE calls SET vapi_deleted_at = now() WHERE id = $1", [row.call_id]);
      deleted++;
    } catch (e) {
      const backoffMin = Math.min(360, 2 ** Math.min(row.attempts + 1, 9));
      await db().query(
        `UPDATE vapi_deletions SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + make_interval(mins => $3)
          WHERE call_id = $1`,
        [row.call_id, errMsg(e).slice(0, 300), backoffMin],
      );
      failed++;
    }
  }
  if (deleted || failed) log.info("Vapi deletions processed", { deleted, failed });
  return { deleted, failed };
}

export async function unconfirmedDeletions(olderThanHours: number): Promise<number> {
  const r = await db().query<{ n: string }>(
    "SELECT count(*) AS n FROM vapi_deletions WHERE confirmed_at IS NULL AND requested_at < now() - make_interval(hours => $1)",
    [olderThanHours],
  );
  return Number(r.rows[0]!.n);
}
