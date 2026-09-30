import { db } from "../../lib/db.js";

export async function bumpToolCount(callId: string, tool: string): Promise<number> {
  const r = await db().query<{ count: number }>(
    `INSERT INTO tool_calls (call_id, tool, count) VALUES ($1, $2, 1)
     ON CONFLICT (call_id, tool) DO UPDATE SET count = tool_calls.count + 1, updated_at = now()
     RETURNING count`,
    [callId, tool],
  );
  return r.rows[0]!.count;
}

export async function totalToolCount(callId: string): Promise<number> {
  const r = await db().query<{ n: string }>("SELECT coalesce(sum(count), 0) AS n FROM tool_calls WHERE call_id = $1", [callId]);
  return Number(r.rows[0]!.n);
}
