import { DateTime } from "luxon";
import { db, tx } from "../lib/db.js";
import { TZ } from "../lib/config.js";

interface Row { day: string; hr: number; lang: string; outcome: string; dur: number; cost: string; nb: number; nt: number; ntc: number; nm: number }
interface Agg { calls: number; dur: number; cost: number; bookings: number; tAtt: number; tConn: number; msgs: number; hours: number[] }

export async function recomputeRollups(fromDay: DateTime, toDay: DateTime): Promise<number> {
  const from = fromDay.setZone(TZ).startOf("day");
  const to = toDay.setZone(TZ).endOf("day");
  const r = await db().query<Row>(
    `SELECT to_char((c.started_at AT TIME ZONE 'Europe/Stockholm')::date, 'YYYY-MM-DD') AS day,
            extract(hour FROM c.started_at AT TIME ZONE 'Europe/Stockholm')::int AS hr,
            coalesce(c.language::text, 'unknown') AS lang, c.outcome::text AS outcome,
            coalesce(c.duration_s, 0) AS dur, coalesce(c.cost_total, 0) AS cost,
            (SELECT count(*) FROM bookings b WHERE b.call_id = c.id)::int AS nb,
            (SELECT count(*) FROM transfers t WHERE t.call_id = c.id AND t.status IN ('dialing','connected','no_answer','busy','failed'))::int AS nt,
            (SELECT count(*) FROM transfers t WHERE t.call_id = c.id AND t.status = 'connected')::int AS ntc,
            (SELECT count(*) FROM messages m WHERE m.call_id = c.id)::int AS nm
       FROM calls c WHERE c.started_at >= $1 AND c.started_at <= $2`,
    [from.toJSDate(), to.toJSDate()],
  );
  const groups = new Map<string, Agg>();
  for (const row of r.rows) {
    const key = `${row.day}|${row.lang}|${row.outcome}`;
    const g = groups.get(key) ?? { calls: 0, dur: 0, cost: 0, bookings: 0, tAtt: 0, tConn: 0, msgs: 0, hours: Array(24).fill(0) };
    g.calls++; g.dur += row.dur; g.cost += Number(row.cost); g.bookings += row.nb; g.tAtt += row.nt; g.tConn += row.ntc; g.msgs += row.nm;
    g.hours[row.hr]! += 1;
    groups.set(key, g);
  }
  await tx(async (c) => {
    await c.query("DELETE FROM daily_rollups WHERE day BETWEEN $1 AND $2", [from.toISODate(), to.toISODate()]);
    for (const [key, g] of groups) {
      const [day, lang, outcome] = key.split("|");
      await c.query(
        `INSERT INTO daily_rollups (day, language, outcome, calls, total_duration_s, total_cost, bookings, transfers_attempted, transfers_connected, messages, hour_histogram)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [day, lang, outcome, g.calls, g.dur, g.cost.toFixed(4), g.bookings, g.tAtt, g.tConn, g.msgs, g.hours],
      );
    }
  });
  return groups.size;
}
