import { z } from "zod";
import { db, tx } from "../../lib/db.js";
import { normalizeE164 } from "../../lib/phone.js";
import { errMsg, type Logger } from "../../lib/log.js";
import { postPendingMessages } from "../../teams/notify.js";
import type { EndOfCallReportT } from "./types.js";
import { langOf } from "./common.js";

const blankToNull = (v: unknown) => (typeof v === "string" && (v.trim() === "" || v === "unknown") ? null : v);
const str = (max: number) => z.preprocess(blankToNull, z.string().max(max).nullish());
const Fields = z.object({
  callerName: str(200),
  company: str(200),
  callbackNumber: str(40),
  reason: str(2000),
  language: z.preprocess(blankToNull, z.enum(["sv", "en"]).nullish()),
  outcome: z.preprocess(blankToNull, z.enum(["faq_answered", "booked", "transferred", "message_taken", "abandoned"]).nullish()),
  staffId: str(64),
  urgency: z.preprocess(blankToNull, z.enum(["low", "normal", "high"]).nullish()),
}).partial();

type Outcome = "faq_answered" | "booked" | "transferred" | "message_taken" | "abandoned";

function structured(report: EndOfCallReportT, name: string): unknown {
  const outs = report.artifact?.structuredOutputs ?? {};
  for (const v of Object.values(outs)) if (v?.name === name) return v.result;
  return undefined;
}

function transcriptText(report: EndOfCallReportT): string | null {
  if (report.artifact?.transcript) return report.artifact.transcript.slice(0, 100_000);
  const msgs = report.artifact?.messages ?? [];
  const lines = msgs
    .filter((m) => (m.role === "user" || m.role === "bot" || m.role === "assistant") && m.message)
    .map((m) => `${m.role === "user" ? "Uppringare" : "AI"}: ${m.message}`);
  return lines.length ? lines.join("\n").slice(0, 100_000) : null;
}

export function reconcileOutcome(facts: { transferredConnected: boolean; booked: boolean; messaged: boolean }, claimed: Outcome | null | undefined): Outcome {
  if (facts.transferredConnected) return "transferred";
  if (facts.booked) return "booked";
  if (facts.messaged) return "message_taken";
  if (claimed === "faq_answered") return "faq_answered";
  return "abandoned";
}

export async function handleEndOfCallReport(report: EndOfCallReportT, log: Logger): Promise<void> {
  const call = report.call;
  const callId = call.id;
  const fieldsRaw = structured(report, "call_fields") ?? report.analysis?.structuredData ?? {};
  const fieldsParsed = Fields.safeParse(fieldsRaw);
  const fields = fieldsParsed.success ? fieldsParsed.data : {};
  const summaryRaw = structured(report, "call_summary_sv");
  const summary = (typeof summaryRaw === "string" ? summaryRaw : (summaryRaw as { summary?: string } | undefined)?.summary)
    ?? report.analysis?.summary ?? null;

  const startedAt = report.startedAt ?? call.startedAt ?? null;
  const endedAt = report.endedAt ?? call.endedAt ?? null;
  const duration = startedAt && endedAt ? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000)) : null;
  const endedReason = report.endedReason ?? null;
  const forwarded = /forwarded|transfer/i.test(endedReason ?? "");

  await tx(async (c) => {
    const bk = await c.query("SELECT staff_id FROM bookings WHERE call_id = $1 ORDER BY created_at LIMIT 1", [callId]);
    const msg = await c.query("SELECT staff_id FROM messages WHERE call_id = $1 ORDER BY created_at LIMIT 1", [callId]);
    const tr = await c.query<{ id: string; staff_id: string }>("SELECT id, staff_id FROM transfers WHERE call_id = $1 AND status = 'dialing' ORDER BY created_at DESC", [callId]);
    const lastDialing = tr.rows[0];
    if (lastDialing) {
      await c.query("UPDATE transfers SET status = $2, updated_at = now() WHERE id = $1", [lastDialing.id, forwarded ? "connected" : "no_answer"]);
      await c.query("UPDATE transfers SET status = 'no_answer', updated_at = now() WHERE call_id = $1 AND status = 'dialing' AND id <> $2", [callId, lastDialing.id]);
    }
    await c.query("UPDATE transfers SET status = 'cancelled', updated_at = now() WHERE call_id = $1 AND status = 'requested'", [callId]);

    const outcome = reconcileOutcome(
      { transferredConnected: Boolean(lastDialing && forwarded), booked: Boolean(bk.rowCount), messaged: Boolean(msg.rowCount) },
      fields.outcome,
    );
    const staffId = (lastDialing && forwarded ? lastDialing.staff_id : null) ?? bk.rows[0]?.staff_id ?? msg.rows[0]?.staff_id ?? null;
    const costBreakdown = call.costBreakdown ?? (report.costs ? { items: report.costs } : null);

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
        callId,
        startedAt ?? new Date().toISOString(),
        endedAt,
        duration,
        fields.language ?? langOf(report.assistant?.name),
        normalizeE164(call.customer?.number ?? "") ?? null,
        fields.callerName ?? null,
        fields.company ?? null,
        fields.callbackNumber ? normalizeE164(fields.callbackNumber) : null,
        fields.reason ?? null,
        outcome,
        fields.urgency ?? null,
        staffId,
        summary?.slice(0, 4000) ?? null,
        transcriptText(report),
        endedReason,
        report.cost ?? call.cost ?? null,
        costBreakdown ? JSON.stringify(costBreakdown) : null,
      ],
    );
    await c.query(
      `INSERT INTO vapi_deletions (call_id, next_attempt_at) VALUES ($1, now() + interval '2 minutes')
       ON CONFLICT (call_id) DO NOTHING`,
      [callId],
    );
    await c.query("DELETE FROM tool_calls WHERE call_id = $1", [callId]);
    await c.query("DELETE FROM tool_call_results WHERE call_id = $1", [callId]);
  });

  try {
    await postPendingMessages(callId, 0, log);
  } catch (e) {
    log.error("Posting messages after call failed", { err: errMsg(e) });
  }
}
