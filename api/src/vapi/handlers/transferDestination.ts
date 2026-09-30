import { db } from "../../lib/db.js";
import { optional } from "../../lib/config.js";
import { officeConfig } from "../../lib/office.js";
import type { Logger } from "../../lib/log.js";
import { transferBlockReason, type TransferTarget } from "../tools/transferToStaff.js";

const MSG = {
  sv: { connecting: "Ett ögonblick, jag kopplar dig nu.", failed: "Jag fick tyvärr inte tag på personen just nu. Jag kan ta ett meddelande så att hen ringer upp dig." },
  en: { connecting: "One moment, I'm connecting you now.", failed: "Unfortunately I couldn't reach them right now. I can take a message so they can call you back." },
};

function clean(s: string | null | undefined, max: number): string {
  return (s ?? "").replace(/[^\p{L}\p{N}\s.,&'\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function transferAssistant(staffName: string, callerName: string, company: string, reason: string, assistantName: string) {
  const who = [callerName, company && `på ${company}`].filter(Boolean).join(" ") || "en uppringare";
  return {
    firstMessage: `Hej ${staffName.split(" ")[0]}, det är ${assistantName}, AI-receptionisten på RKJH. Jag har ${who} i luren angående ${reason || "ett ärende"}. Vill du ta samtalet?`,
    firstMessageMode: "assistant-speaks-first",
    maxDurationSeconds: 90,
    silenceTimeoutSeconds: 20,
    transcriber: { provider: "azure", language: "sv-SE" },
    voice: { provider: "azure", voiceId: optional("VAPI_VOICE_SV", "sv-SE-SofieNeural") },
    model: {
      provider: "openai",
      model: optional("VAPI_LLM_MODEL", "gpt-5.4-mini:swedencentral"),
      messages: [{
        role: "system",
        content: [
          "Du är AI-receptionisten på Revisionskonsulterna J Hägglund och ringer en kollega för att koppla fram ett samtal.",
          "Svara kort på svenska. Ge en mycket kort sammanfattning av ärendet om kollegan frågar.",
          "Anropa transferSuccessful direkt när en människa bekräftar att hen tar samtalet.",
          "Anropa transferCancel om du hör en röstbrevlåda, ett automatiskt meddelande, en kö, upptaget, ingen svarar, eller om kollegan säger nej eller ber att ta ett meddelande.",
          "Prata aldrig om annat än själva kopplingen.",
        ].join(" "),
      }],
    },
  };
}

export async function handleTransferDestinationRequest(callId: string | undefined, lang: "sv" | "en", log: Logger) {
  if (!callId) return { error: MSG[lang].failed };
  const cfg = await officeConfig();
  const r = await db().query<TransferTarget & { transfer_id: string; reason: string | null; caller_name: string | null; company: string | null }>(
    `UPDATE transfers t SET consumed_at = now(), status = 'dialing', updated_at = now()
       FROM staff s
      WHERE t.id = (SELECT id FROM transfers WHERE call_id = $1 AND status = 'requested' AND consumed_at IS NULL
                      AND created_at > now() - interval '5 minutes' ORDER BY created_at DESC LIMIT 1)
        AND s.id = t.staff_id
      RETURNING t.id AS transfer_id, t.reason, t.caller_name, t.company, s.id, s.name, s.direct_phone_e164, s.transferable, s.active`,
    [callId],
  );
  const row = r.rows[0];
  if (!row) {
    log.warn("transfer-destination-request without approved transfer");
    return { error: MSG[lang].failed };
  }
  const block = transferBlockReason(row, cfg, process.env.TWILIO_NUMBER_E164);
  if (block) {
    await db().query("UPDATE transfers SET status = 'refused', updated_at = now() WHERE id = $1", [row.transfer_id]);
    log.warn("Transfer refused at destination stage", { block });
    return { error: MSG[lang].failed };
  }
  return {
    destination: {
      type: "number",
      number: row.direct_phone_e164!,
      numberE164CheckEnabled: true,
      message: MSG[lang].connecting,
      callerId: process.env.TRANSFER_CALLER_ID || undefined,
      transferPlan: {
        mode: "warm-transfer-experimental",
        transferAssistant: transferAssistant(row.name, clean(row.caller_name, 60), clean(row.company, 80), clean(row.reason, 160), cfg.assistantName),
        summaryPlan: { enabled: true, timeoutSeconds: 5 },
        fallbackPlan: { message: MSG[lang].failed, endCallEnabled: false },
      },
    },
  };
}
