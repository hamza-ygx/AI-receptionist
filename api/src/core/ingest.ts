import { tx } from "../lib/db.js";
import { normalizeE164 } from "../lib/phone.js";
import { errMsg, type Logger } from "../lib/log.js";
import { postPendingMessages } from "../teams/notify.js";
import type { CallFields } from "./analysis.js";

export type Outcome = "faq_answered" | "booked" | "transferred" | "message_taken" | "abandoned";

export interface CallRecord {
  callId: string;
  startedAt: Date;
  endedAt: Date;
  language: "sv" | "en";
  callerNumber: string | null;
  transcript: string | null;
  summarySv: string | null;
  fields: CallFields;
  endedReason: string;
  costTotal: number | null;
  costBreakdown: Record<string, unknown> | null;
}

export function reconcileOutcome(facts: { transferred: boolean; booked: boolean; messaged: boolean }, claimed: Outcome | null | undefined): Outcome {
  if (facts.transferred) return "transferred";
  if (facts.booked) return "booked";
  if (facts.messaged) return "message_taken";
  if (claimed === "faq_answered") return "faq_answered";
  return "abandoned";
}

export async function ingestCall(rec: CallRecord, log: Logger): Promise<Outcome> {
  const outcome = await tx(async (c) => {
    await c.query("UPDATE transfers SET status = 'failed', updated_at = now() WHERE call_id = $1 AND status IN ('requested','dialing')", [rec.callId]);
    const bk = await c.query<{ staff_id: string }>("SELECT staff_id FROM bookings WHERE call_id = $1 ORDER BY created_at LIMIT 1", [rec.callId]);
    const msg = await c.query<{ staff_id: string | null }>("SELECT staff_id FROM messages WHERE call_id = $1 ORDER BY created_at LIMIT 1", [rec.callId]);
    const tr = await c.query<{ staff_id: string }>("SELECT staff_id FROM transfers WHERE call_id = $1 AND status = 'connected' ORDER BY created_at DESC LIMIT 1", [rec.callId]);

    const result = reconcileOutcome({ transferred: Boolean(tr.rowCount), booked: Boolean(bk.rowCount), messaged: Boolean(msg.rowCount) }, rec.fields.outcome);
    const staffId = tr.rows[0]?.staff_id ?? bk.rows[0]?.staff_id ?? msg.rows[0]?.staff_id ?? null;
    const f = rec.fields;
    await c.query(
      `INSERT INTO calls (id, started_at, ended_at, duration_s, language, caller_number_e164, caller_name, company, callback_number,
                          reason, outcome, urgency, staff_id, summary_sv, transcript, ended_reason, cost_total, cost_breakdown)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET
         ended_at = EXCLUDED.ended_at, duration_s = EXCLUDED.duration_s, language = EXCLUDED.language,
         caller_name = EXCLUDED.caller_name, company = EXCLUDED.company, callback_number = EXCLUDED.callback_number,
         reason = EXCLUDED.reason, outcome = EXCLUDED.outcome, urgency = EXCLUDED.urgency, staff_id = EXCLUDED.staff_id,
         summary_sv = EXCLUDED.summary_sv, transcript = EXCLUDED.transcript, ended_reason = EXCLUDED.ended_reason,
         cost_total = EXCLUDED.cost_total, cost_breakdown = EXCLUDED.cost_breakdown`,
      [
        rec.callId,
        rec.startedAt,
        rec.endedAt,
        Math.max(0, Math.round((rec.endedAt.getTime() - rec.startedAt.getTime()) / 1000)),
        f.language ?? rec.language,
        rec.callerNumber,
        f.callerName?.slice(0, 200) ?? null,
        f.company?.slice(0, 200) ?? null,
        f.callbackNumber ? normalizeE164(f.callbackNumber) : null,
        f.reason?.slice(0, 2000) ?? null,
        result,
        f.urgency ?? null,
        staffId,
        rec.summarySv?.slice(0, 4000) ?? null,
        rec.transcript?.slice(0, 100_000) ?? null,
        rec.endedReason,
        rec.costTotal,
        rec.costBreakdown ? JSON.stringify(rec.costBreakdown) : null,
      ],
    );
    await c.query("DELETE FROM tool_calls WHERE call_id = $1", [rec.callId]);
    await c.query("DELETE FROM tool_call_results WHERE call_id = $1", [rec.callId]);
    return result;
  });
  try {
    await postPendingMessages(rec.callId, 0, log);
  } catch (e) {
    log.error("Posting messages after call failed", { err: errMsg(e) });
  }
  return outcome;
}
