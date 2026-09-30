import { DateTime } from "luxon";
import { TZ, optional } from "../lib/config.js";
import { spokenSwedish } from "../lib/phone.js";

type Fact = { title: string; value: string };

const OUTCOME_SV: Record<string, string> = {
  faq_answered: "Fråga besvarad",
  booked: "Möte bokat",
  transferred: "Kopplad",
  message_taken: "Meddelande",
  abandoned: "Avbrutet",
};
const URGENCY_SV: Record<string, string> = { low: "Låg", normal: "Normal", high: "Hög" };
const URGENCY_COLOR: Record<string, string> = { low: "Good", normal: "Accent", high: "Attention" };

function dashLink(callId: string): string {
  const base = optional("DASHBOARD_BASE_URL", "http://localhost:5173").replace(/\/$/, "");
  return `${base}/calls/${encodeURIComponent(callId)}`;
}

function card(title: string, color: string, facts: Fact[], body: string | null, callId: string) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    msteams: { width: "Full" },
    body: [
      { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", color, wrap: true },
      { type: "FactSet", facts: facts.filter((f) => f.value) },
      ...(body ? [{ type: "TextBlock", text: body, wrap: true, spacing: "Medium" }] : []),
    ],
    actions: [{ type: "Action.OpenUrl", title: "Öppna samtal", url: dashLink(callId) }],
  };
}

export interface MessageCardInput {
  callId: string;
  staffName: string | null;
  callerName: string;
  company: string | null;
  phone: string;
  language: string | null;
  reason: string;
  urgency: string;
  outcome: string;
  summary: string | null;
}

export function messageCard(m: MessageCardInput) {
  const who = m.company ? `${m.callerName} (${m.company})` : m.callerName;
  return card(
    `${m.urgency === "high" ? "🔴 " : ""}Meddelande${m.staffName ? ` till ${m.staffName}` : ""}: ${who}`,
    URGENCY_COLOR[m.urgency] ?? "Accent",
    [
      { title: "Uppringare", value: m.callerName },
      { title: "Företag", value: m.company ?? "" },
      { title: "Telefon", value: spokenSwedish(m.phone) },
      { title: "Språk", value: m.language === "en" ? "Engelska" : "Svenska" },
      { title: "Ärende", value: m.reason },
      { title: "Brådska", value: URGENCY_SV[m.urgency] ?? m.urgency },
      { title: "Utfall", value: OUTCOME_SV[m.outcome] ?? m.outcome },
    ],
    m.summary ? `**Sammanfattning:** ${m.summary}` : null,
    m.callId,
  );
}

export interface BookingCardInput {
  callId: string;
  staffName: string;
  callerName: string;
  company: string | null;
  phone: string;
  email: string | null;
  topic: string;
  meetingType: "phone" | "teams" | "office";
  start: Date;
  end: Date;
  language: string;
}

const MEETING_SV = { phone: "Telefonmöte", teams: "Teams-möte", office: "Möte på kontoret" } as const;

export function bookingCard(b: BookingCardInput) {
  const s = DateTime.fromJSDate(b.start).setZone(TZ).setLocale("sv");
  const e = DateTime.fromJSDate(b.end).setZone(TZ);
  return card(
    `📅 Nytt möte bokat åt ${b.staffName}`,
    "Good",
    [
      { title: "När", value: `${s.toFormat("cccc d LLLL yyyy 'kl.' HH:mm")}–${e.toFormat("HH:mm")}` },
      { title: "Typ", value: MEETING_SV[b.meetingType] },
      { title: "Uppringare", value: b.callerName },
      { title: "Företag", value: b.company ?? "" },
      { title: "Telefon", value: spokenSwedish(b.phone) },
      { title: "E-post", value: b.email ?? "" },
      { title: "Ämne", value: b.topic },
      { title: "Språk", value: b.language === "en" ? "Engelska" : "Svenska" },
    ],
    null,
    b.callId,
  );
}
