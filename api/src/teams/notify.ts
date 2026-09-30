import { db } from "../lib/db.js";
import { officeConfig } from "../lib/office.js";
import type { Logger } from "../lib/log.js";
import { errMsg } from "../lib/log.js";
import { messageCard, bookingCard, type BookingCardInput } from "./cards.js";
import { postCard } from "./post.js";

async function refFor(staffId: string | null): Promise<string> {
  if (staffId) {
    const r = await db().query<{ teams_webhook_ref: string | null }>("SELECT teams_webhook_ref FROM staff WHERE id = $1", [staffId]);
    const ref = r.rows[0]?.teams_webhook_ref;
    if (ref) return ref;
  }
  return (await officeConfig()).receptionTeamsWebhookRef;
}

export async function postMessage(messageId: string, log: Logger): Promise<boolean> {
  const r = await db().query(
    `SELECT m.*, s.name AS staff_name, c.summary_sv, c.outcome
       FROM messages m
       LEFT JOIN staff s ON s.id = m.staff_id
       LEFT JOIN calls c ON c.id = m.call_id
      WHERE m.id = $1 AND m.teams_posted_at IS NULL`,
    [messageId],
  );
  const m = r.rows[0];
  if (!m) return false;
  const ref = await refFor(m.staff_id);
  const card = messageCard({
    callId: m.call_id,
    staffName: m.staff_name,
    callerName: m.caller_name,
    company: m.company,
    phone: m.phone_e164,
    language: m.language,
    reason: m.reason,
    urgency: m.urgency,
    outcome: m.outcome ?? "message_taken",
    summary: m.summary_sv,
  });
  try {
    await postCard(ref, card);
  } catch (e) {
    if (ref !== (await officeConfig()).receptionTeamsWebhookRef) {
      log.warn("Consultant Teams post failed, falling back to reception", { err: errMsg(e) });
      await postCard((await officeConfig()).receptionTeamsWebhookRef, card);
    } else {
      throw e;
    }
  }
  await db().query("UPDATE messages SET teams_posted_at = now() WHERE id = $1", [messageId]);
  return true;
}

export async function postPendingMessages(callId: string | null, olderThanMinutes: number, log: Logger): Promise<number> {
  const r = await db().query<{ id: string }>(
    `SELECT id FROM messages WHERE teams_posted_at IS NULL
        AND ($1::text IS NULL OR call_id = $1)
        AND created_at < now() - make_interval(mins => $2)
      ORDER BY created_at LIMIT 50`,
    [callId, olderThanMinutes],
  );
  let n = 0;
  for (const { id } of r.rows) {
    try {
      if (await postMessage(id, log)) n++;
    } catch (e) {
      log.error("Teams post failed", { messageId: id, err: errMsg(e) });
    }
  }
  return n;
}

export async function notifyBooking(staffId: string, input: BookingCardInput, log: Logger): Promise<void> {
  try {
    await postCard(await refFor(staffId), bookingCard(input));
  } catch (e) {
    log.error("Teams booking notification failed", { err: errMsg(e) });
  }
}
