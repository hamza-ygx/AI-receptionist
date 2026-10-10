import { db } from "../lib/db.js";
import { optional } from "../lib/config.js";
import { describeHours, holidayName, isOpenNow, canTransferNow, nowLocal, officeConfig } from "../lib/office.js";
import { normalizeE164, spokenSwedish } from "../lib/phone.js";
import { errMsg, type Logger } from "../lib/log.js";
import { inlineCorpus } from "../kb/inline.js";

interface CoreFacts { sv: string; en: string }

function anonymous(num: string | null | undefined): boolean {
  return !num || /anonymous|unknown|restricted|private|^sip:/i.test(num);
}

export interface CallVariables {
  vars: Record<string, string>;
  callerE164: string | null;
}

export async function buildVariables(customerNumber: string | null | undefined, log: Logger): Promise<CallVariables> {
  const now = nowLocal();
  const e164 = anonymous(customerNumber) ? null : normalizeE164(customerNumber!);
  const vars: Record<string, string> = {
    now_sv: now.setLocale("sv").toFormat("cccc d LLLL yyyy 'kl.' HH:mm"),
    now_en: now.setLocale("en-GB").toFormat("cccc d LLLL yyyy 'at' HH:mm"),
    today_iso: now.toISODate()!,
    assistant_name: optional("ASSISTANT_NAME", "ASSISTANT_NAME"),
    company_name: "Revisionskonsulterna J Hägglund",
    office_open: "unknown",
    transfer_possible: "false",
    opening_hours_sv: "",
    opening_hours_en: "",
    holiday_line_sv: "",
    holiday_line_en: "",
    caller_line_sv: e164
      ? `Numret de ringer från är ${spokenSwedish(e164)}. Fråga: "Kan vi nå dig på numret du ringer från, ${spokenSwedish(e164)}?" och använd det om de säger ja.`
      : "Numret de ringer från är dolt, så be om ett nummer och läs tillbaka det.",
    caller_line_en: e164
      ? `They are calling from ${e164}. Ask: "Can we reach you on the number you're calling from?" and read it back; use it if they say yes.`
      : "Their number is hidden, so ask for a number and read it back.",
    core_facts_sv: "",
    core_facts_en: "",
    kb_section_sv: "",
    kb_section_en: "",
  };
  try {
    const cfg = await officeConfig();
    vars.assistant_name = cfg.assistantName;
    vars.company_name = cfg.companyName;
    vars.office_open = String(isOpenNow(cfg, now));
    vars.transfer_possible = String(canTransferNow(cfg, now));
    const holiday = holidayName(now, cfg);
    if (holiday) {
      vars.holiday_line_sv = `Idag är det helgdag (${holiday}) och kontoret är stängt.`;
      vars.holiday_line_en = `Today is a Swedish public holiday (${holiday}) and the office is closed.`;
    }
    vars.opening_hours_sv = describeHours(cfg, "sv");
    vars.opening_hours_en = describeHours(cfg, "en");
    const facts = (await db().query<{ value: CoreFacts }>("SELECT value FROM settings WHERE key = 'core_facts'")).rows[0]?.value;
    if (facts) {
      vars.core_facts_sv = facts.sv;
      vars.core_facts_en = facts.en;
    }
    const inline = await inlineCorpus();
    if (inline?.sv) vars.kb_section_sv = `# Kunskapsbas\n${inline.sv}`;
    if (inline?.en) vars.kb_section_en = `# Knowledge base\n${inline.en}`;
  } catch (e) {
    log.error("Call variables degraded", { err: errMsg(e) });
  }
  return { vars, callerE164: e164 };
}
