import { db } from "../../lib/db.js";
import { optional, required } from "../../lib/config.js";
import { describeHours, holidayName, isOpenNow, canTransferNow, nowLocal, officeConfig } from "../../lib/office.js";
import { normalizeE164, spokenSwedish } from "../../lib/phone.js";
import { errMsg, type Logger } from "../../lib/log.js";
import { inlineCorpus } from "../../kb/inline.js";

interface CoreFacts { sv: string; en: string }

async function setting<T>(key: string): Promise<T | null> {
  const r = await db().query<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  return r.rows[0]?.value ?? null;
}

function anonymous(num: string | null | undefined): boolean {
  return !num || /anonymous|unknown|restricted|private/i.test(num);
}

export async function buildVariables(customerNumber: string | null | undefined, log: Logger): Promise<Record<string, string>> {
  const now = nowLocal();
  const vars: Record<string, string> = {
    now_sv: now.setLocale("sv").toFormat("cccc d LLLL yyyy 'kl.' HH:mm"),
    now_en: now.setLocale("en-GB").toFormat("cccc d LLLL yyyy 'at' HH:mm"),
    today_iso: now.toISODate()!,
    now_iso: now.toISO()!,
    caller_number: "",
    caller_number_spoken: "",
    caller_number_known: "false",
    office_open: "unknown",
    transfer_possible: "false",
    holiday_today: "",
    opening_hours_sv: "",
    opening_hours_en: "",
    assistant_name: optional("ASSISTANT_NAME", "ASSISTANT_NAME"),
    company_name: "Revisionskonsulterna J Hägglund",
    core_facts_sv: "",
    core_facts_en: "",
    kb_inline_sv: "",
    kb_inline_en: "",
  };
  const e164 = anonymous(customerNumber) ? null : normalizeE164(customerNumber!);
  if (e164) {
    vars.caller_number = e164;
    vars.caller_number_spoken = spokenSwedish(e164);
    vars.caller_number_known = "true";
  }
  try {
    const cfg = await officeConfig();
    vars.assistant_name = cfg.assistantName;
    vars.company_name = cfg.companyName;
    vars.office_open = String(isOpenNow(cfg, now));
    vars.transfer_possible = String(canTransferNow(cfg, now));
    vars.holiday_today = holidayName(now, cfg) ?? "";
    vars.opening_hours_sv = describeHours(cfg, "sv");
    vars.opening_hours_en = describeHours(cfg, "en");
    const facts = await setting<CoreFacts>("core_facts");
    if (facts) {
      vars.core_facts_sv = facts.sv;
      vars.core_facts_en = facts.en;
    }
    const inline = await inlineCorpus();
    if (inline) {
      vars.kb_inline_sv = inline.sv;
      vars.kb_inline_en = inline.en;
    }
  } catch (e) {
    log.error("assistant-request degraded: variables incomplete", { err: errMsg(e) });
  }
  return vars;
}

export async function handleAssistantRequest(customerNumber: string | null | undefined, log: Logger) {
  const variableValues = await buildVariables(customerNumber, log);
  return {
    squadId: required("VAPI_SQUAD_ID"),
    squadOverrides: { variableValues },
  };
}
