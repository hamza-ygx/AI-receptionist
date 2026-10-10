import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const DATA = JSON.parse(readFileSync(new URL("./_data.json", import.meta.url), "utf8"));
const TZ = "Europe/Stockholm";
const MODEL = process.env.DEMO_MODEL || "claude-opus-5-5";
const EFFORT = process.env.DEMO_EFFORT || "low";
const MAX_LOOPS = 6;
const MAX_HISTORY_BYTES = 400_000;
const PRICE = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };

const client = new Anthropic();

const STAFF = [
  {
    id: "jorgen-hagglund",
    name: "Jörgen Hägglund",
    role: "VD, auktoriserad revisor",
    topics: ["revision", "bokslut", "årsredovisning", "företagsvärdering", "skatterådgivning"],
    transferable: false,
    bookable: true,
    demoTransfer: null,
  },
  {
    id: "anna-demo",
    name: "Anna Exempel",
    role: "Redovisningskonsult (fiktiv demoperson)",
    topics: ["bokföring", "lön", "moms", "deklaration", "starta eget"],
    transferable: true,
    bookable: true,
    demoTransfer: "connected",
  },
  {
    id: "erik-demo",
    name: "Erik Exempel",
    role: "Revisor (fiktiv demoperson)",
    topics: ["revision", "bokslut", "årsredovisning"],
    transferable: true,
    bookable: true,
    demoTransfer: "busy",
  },
];

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_SV = { mon: "måndag", tue: "tisdag", wed: "onsdag", thu: "torsdag", fri: "fredag", sat: "lördag", sun: "söndag" };
const DAY_EN = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function localParts(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  return {
    iso: `${p.year}-${p.month}-${p.day}`,
    hm: `${p.hour}:${p.minute}`,
    day: p.weekday.toLowerCase().slice(0, 3),
  };
}

function offsetFor(isoDate) {
  const probe = new Date(`${isoDate}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(probe).find((x) => x.type === "timeZoneName").value;
  const m = name.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

function at(isoDate, hm) {
  return new Date(`${isoDate}T${hm}:00${offsetFor(isoDate)}`);
}

function withinRanges(ranges, hm) {
  return (ranges ?? []).some(([a, b]) => hm >= a && hm < b);
}

function describeHours(lang) {
  const names = lang === "sv" ? DAY_SV : DAY_EN;
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    .map((d) => {
      const r = DATA.office.openingHours[d] ?? [];
      const closed = lang === "sv" ? "stängt" : "closed";
      return `${names[d]} ${r.length ? r.map(([a, b]) => `${a}–${b}`).join(", ") : closed}`;
    })
    .join("; ");
}

function officeState(now, simulateOpen) {
  const { day, hm } = localParts(now);
  const open = simulateOpen || withinRanges(DATA.office.openingHours[day], hm);
  const transfer = simulateOpen || withinRanges((DATA.office.transferHours ?? DATA.office.openingHours)[day], hm);
  return { open, transfer };
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function buildPrompts(startedAt, simulateOpen) {
  const { open, transfer } = officeState(startedAt, simulateOpen);
  const vars = {
    now_sv: new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(startedAt),
    now_en: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(startedAt),
    today_iso: localParts(startedAt).iso,
    assistant_name: process.env.DEMO_ASSISTANT_NAME || "Ellen",
    company_name: DATA.office.companyName,
    office_open: String(open),
    transfer_possible: String(transfer),
    opening_hours_sv: describeHours("sv"),
    opening_hours_en: describeHours("en"),
    holiday_line_sv: "",
    holiday_line_en: "",
    caller_line_sv: "Numret de ringer från är dolt, så be om ett nummer och läs tillbaka det.",
    caller_line_en: "Their number is hidden, so ask for a number and read it back.",
    core_facts_sv: DATA.facts.sv,
    core_facts_en: DATA.facts.en,
    kb_section_sv: "",
    kb_section_en: "",
  };
  const demoSv =
    "\n# Demo\nDetta är en webbdemo. Uppringarens repliker kommer från taligenkänning i webbläsaren och kan innehålla felhörningar. All personal utom Jörgen Hägglund är fiktiv, och bokningar, meddelanden och kopplingar är simulerade. Låtsas ändå att det är ett riktigt samtal.";
  const demoEn =
    "\n# Demo\nThis is a web demo. The caller's lines come from browser speech recognition and may contain mishearings. All staff except Jörgen Hägglund are fictional, and bookings, messages and transfers are simulated. Still behave as if it were a real call.";
  return { sv: render(DATA.promptSv, vars) + demoSv, en: render(DATA.promptEn, vars) + demoEn };
}

const staffIdProp = { type: "string", description: "staffId exactly as returned by resolve_staff or check_availability. Never invent one." };

const BUSINESS_TOOLS = [
  {
    name: "search_knowledge",
    description: "Search RKJH's approved FAQ and website content. Use for any factual question about the firm (services, office, hours, how things work). Never answer factual questions about RKJH from memory.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Short search query in the caller's language." },
        lang: { type: "string", enum: ["sv", "en"] },
      },
      required: ["query"],
    },
  },
  {
    name: "resolve_staff",
    description: "Find a staff member by (part of) name, or the right consultant for a topic such as bokslut, deklaration, lön, revision, moms. Returns staffId, name, role, and whether they can be transferred to or booked.",
    input_schema: { type: "object", properties: { nameOrTopic: { type: "string" } }, required: ["nameOrTopic"] },
  },
  {
    name: "check_availability",
    description: "Get free meeting times. Give staffId if the caller wants a specific person, otherwise topic. Dates are ISO dates (YYYY-MM-DD) in Swedish time; range max 14 days.",
    input_schema: {
      type: "object",
      properties: {
        staffId: staffIdProp,
        topic: { type: "string" },
        dateFrom: { type: "string", description: "YYYY-MM-DD" },
        dateTo: { type: "string", description: "YYYY-MM-DD" },
        durationMin: { type: "integer", description: "Meeting length in minutes: 30 or 60. Default 30 unless the caller asks for longer." },
      },
      required: ["dateFrom", "dateTo", "durationMin"],
    },
  },
  {
    name: "book_meeting",
    description: "Book a meeting in a consultant's calendar. Only after the caller has chosen a slot from check_availability AND you have read back and confirmed name, company, phone number, date, time and meeting type.",
    input_schema: {
      type: "object",
      properties: {
        staffId: staffIdProp,
        start: { type: "string", description: "Exact 'start' value from check_availability." },
        end: { type: "string", description: "Exact 'end' value from check_availability." },
        callerName: { type: "string" },
        company: { type: "string" },
        phone: { type: "string", description: "Confirmed callback number." },
        email: { type: "string", description: "Only if the caller gave and confirmed it (spelled back). Needed to send a Teams invite." },
        topic: { type: "string", description: "Short neutral description of what the meeting is about." },
        meetingType: { type: "string", enum: ["phone", "teams", "office"] },
      },
      required: ["staffId", "start", "end", "callerName", "phone", "topic", "meetingType"],
    },
  },
  {
    name: "take_message",
    description: "Leave a message for a consultant (or reception if no staffId). Use for callbacks, reschedule/cancel requests, specific questions, and when transfer/booking isn't possible. Confirm name, company, phone and reason first.",
    input_schema: {
      type: "object",
      properties: {
        staffId: staffIdProp,
        callerName: { type: "string" },
        company: { type: "string" },
        phone: { type: "string" },
        reason: { type: "string", description: "What the caller wants, in neutral words. No advice." },
        urgency: { type: "string", enum: ["low", "normal", "high"] },
      },
      required: ["callerName", "phone", "reason", "urgency"],
    },
  },
  {
    name: "transfer_to_staff",
    description: "Transfer the caller live to a staff member. The server checks office hours and whether the person takes calls. The caller is put on hold while the colleague is asked. Returns the outcome; if not connected, offer to take a message.",
    input_schema: {
      type: "object",
      properties: {
        staffId: { type: "string", description: "staffId exactly as returned by resolve_staff." },
        reason: { type: "string", description: "One short neutral sentence about the matter, for the colleague." },
        callerName: { type: "string" },
        company: { type: "string" },
      },
      required: ["staffId", "reason"],
    },
  },
  {
    name: "end_call",
    description: "End the call after you have said goodbye.",
    input_schema: { type: "object", properties: {} },
  },
];

const TOOLS = [
  { name: "switch_to_english", description: "Switch to English when the caller speaks English or asks for English. Only while the conversation is in Swedish.", input_schema: { type: "object", properties: {} } },
  { name: "switch_to_swedish", description: "Switch to Swedish when the caller speaks Swedish or asks for Swedish. Only while the conversation is in English.", input_schema: { type: "object", properties: {} } },
  ...BUSINESS_TOOLS,
];

const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function words(s) {
  return s.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
}

function searchKnowledge(args, lang) {
  const q = words(str(args.query, 200));
  const l = args.lang === "en" || args.lang === "sv" ? args.lang : lang;
  const docs = [
    ...DATA.faq.map((f) => ({ q: f[`question_${l}`], a: f[`answer_${l}`], source: "faq" })),
    ...DATA.facts[l].split("\n").filter(Boolean).map((line) => ({ q: "", a: line.trim(), source: "core_facts" })),
  ];
  const scored = docs
    .map((d) => {
      const hay = words(`${d.q} ${d.a}`);
      const score = q.reduce((s, w) => s + (hay.some((h) => h.startsWith(w.slice(0, 5))) ? 1 : 0), 0) + (d.source === "faq" ? 0.5 : 0);
      return { ...d, score };
    })
    .filter((d) => d.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!scored.length) {
    return { ok: true, results: [], instruction: l === "sv" ? "Inget i kunskapsbasen. Säg att du inte har den uppgiften och erbjud att ta ett meddelande." : "Nothing in the knowledge base. Say you don't have that information and offer to take a message." };
  }
  return { ok: true, results: scored.map(({ q: question, a: answer, source }) => ({ question, answer, source })) };
}

function publicStaff(s) {
  return { staffId: s.id, name: s.name, role: s.role, topics: s.topics, transferable: s.transferable, bookable: s.bookable };
}

function normTopic(t) {
  const k = t.toLowerCase().trim();
  return DATA.office.topicAliases?.[k] ?? k;
}

function staffForTopic(topic) {
  const t = normTopic(topic);
  return STAFF.filter((s) => s.topics.some((x) => x === t || x.includes(t) || t.includes(x)));
}

function resolveStaff(args) {
  const q = str(args.nameOrTopic, 100).toLowerCase();
  if (!q) return { ok: false, error: "empty", instruction: "Fråga vem eller vilket ärende det gäller." };
  const byName = STAFF.filter((s) => s.name.toLowerCase().split(" ").some((p) => p.startsWith(q) || q.includes(p)));
  const found = byName.length ? byName : staffForTopic(q);
  if (!found.length) return { ok: true, matches: [], instruction: "Ingen träff. Erbjud att ta ett meddelande till receptionen." };
  return { ok: true, matches: found.map(publicStaff) };
}

function slotHash(staffId, startIso) {
  return createHash("sha1").update(`${staffId}|${startIso}`).digest()[0];
}

function slotsFor(staff, dateFrom, dateTo, durationMin, now) {
  const earliest = new Date(now.getTime() + DATA.office.minNoticeHours * 3600_000);
  const latest = new Date(now.getTime() + DATA.office.maxDaysAhead * 86400_000);
  const out = [];
  for (let d = new Date(`${dateFrom}T12:00:00Z`); localParts(d).iso <= dateTo; d = new Date(d.getTime() + 86400_000)) {
    const iso = localParts(d).iso;
    const day = DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
    for (const [a, b] of DATA.office.bookingHours[day] ?? []) {
      for (let t = at(iso, a); t.getTime() + durationMin * 60_000 <= at(iso, b).getTime(); t = new Date(t.getTime() + DATA.office.slotStepMin * 60_000)) {
        if (t < earliest || t > latest) continue;
        const start = `${iso}T${localParts(t).hm}:00${offsetFor(iso)}`;
        if (slotHash(staff.id, start) % 3 === 0) continue;
        const e = new Date(t.getTime() + durationMin * 60_000);
        out.push({ staffId: staff.id, staffName: staff.name, start, end: `${iso}T${localParts(e).hm}:00${offsetFor(iso)}` });
      }
    }
  }
  return out;
}

function spread(slots, n) {
  if (slots.length <= n) return slots;
  const step = slots.length / n;
  return Array.from({ length: n }, (_, i) => slots[Math.floor(i * step)]);
}

function checkAvailability(args, now) {
  const dateFrom = str(args.dateFrom, 10);
  const dateTo = str(args.dateTo, 10);
  const durationMin = Number(args.durationMin) === 60 ? 60 : 30;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateTo < dateFrom) {
    return { ok: false, error: "bad_dates", instruction: "Fråga uppringaren vilka dagar som passar." };
  }
  if ((Date.parse(dateTo) - Date.parse(dateFrom)) / 86400_000 > 14) {
    return { ok: false, error: "range_too_long", instruction: "Fråga efter ett kortare datumintervall, högst två veckor." };
  }
  let staff;
  if (args.staffId) {
    const s = STAFF.find((x) => x.id === args.staffId);
    if (!s) return { ok: false, error: "unknown_staff", instruction: "Använd resolve_staff först." };
    if (!s.bookable) return { ok: false, error: "not_bookable", instruction: "Erbjud att ta ett meddelande." };
    staff = [s];
  } else {
    staff = args.topic ? staffForTopic(String(args.topic)) : [];
    if (!staff.length) staff = STAFF.filter((s) => s.bookable);
  }
  const all = staff.flatMap((s) => slotsFor(s, dateFrom, dateTo, durationMin, now)).sort((a, b) => a.start.localeCompare(b.start));
  if (!all.length) {
    return { ok: true, slots: [], instruction: `Inga lediga tider i intervallet. Tider kan bokas tidigast ${DATA.office.minNoticeHours} timmar och senast ${DATA.office.maxDaysAhead} dagar framåt. Föreslå andra dagar.` };
  }
  return { ok: true, durationMin, slots: spread(all, 6) };
}

function countToolUses(history, name, okOnly) {
  let n = 0;
  const results = new Map();
  for (const m of history) {
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b?.type === "tool_result") results.set(b.tool_use_id, typeof b.content === "string" ? b.content : "");
    }
  }
  for (const m of history) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b?.type !== "tool_use" || (name && b.name !== name)) continue;
      if (okOnly && !String(results.get(b.id) ?? "").includes('"ok":true')) continue;
      n++;
    }
  }
  return n;
}

function ref() {
  return `DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function bookMeeting(args, now, history) {
  if (countToolUses(history, "book_meeting", true) >= DATA.office.limits.maxBookingsPerCall) {
    return { ok: false, error: "limit", instruction: "Max antal bokningar per samtal är nått. Erbjud att ta ett meddelande." };
  }
  const s = STAFF.find((x) => x.id === args.staffId);
  if (!s || !s.bookable) return { ok: false, error: "unknown_staff", instruction: "Använd ett staffId från check_availability." };
  for (const k of ["callerName", "phone", "topic"]) {
    if (!str(args[k])) return { ok: false, error: `missing_${k}`, instruction: "Samla in och bekräfta uppgiften först." };
  }
  if (!["phone", "teams", "office"].includes(args.meetingType)) return { ok: false, error: "bad_meeting_type", instruction: "Fråga om mötet ska vara via telefon, Teams eller på kontoret." };
  if (args.meetingType === "teams" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(args.email))) {
    return { ok: false, error: "email_required", instruction: "Teams-möten kräver en e-postadress. Be uppringaren stava den och läs tillbaka." };
  }
  const start = str(args.start, 40);
  const end = str(args.end, 40);
  const durationMin = (Date.parse(end) - Date.parse(start)) / 60_000;
  if (![30, 60].includes(durationMin)) return { ok: false, error: "bad_slot", instruction: "Använd exakt start och slut från check_availability." };
  const iso = start.slice(0, 10);
  const valid = slotsFor(s, iso, iso, durationMin, now).some((x) => x.start === start && x.end === end);
  if (!valid) return { ok: false, error: "slot_taken", instruction: "Tiden är inte längre ledig. Kontrollera tillgängligheten igen och erbjud nya tider." };
  return { ok: true, bookingRef: ref(), staffName: s.name, start, end, meetingType: args.meetingType, demo: "Simulerad bokning, ingen riktig kalenderpost skapades." };
}

function takeMessage(args, history) {
  if (countToolUses(history, "take_message", true) >= DATA.office.limits.maxMessagesPerCall) {
    return { ok: false, error: "limit", instruction: "Max antal meddelanden per samtal är nått." };
  }
  for (const k of ["callerName", "phone", "reason"]) {
    if (!str(args[k])) return { ok: false, error: `missing_${k}`, instruction: "Samla in och bekräfta uppgiften först." };
  }
  const s = args.staffId ? STAFF.find((x) => x.id === args.staffId) : null;
  if (args.staffId && !s) return { ok: false, error: "unknown_staff", instruction: "Använd resolve_staff, eller lämna meddelandet till receptionen utan staffId." };
  return { ok: true, messageRef: ref(), recipient: s ? s.name : "receptionen", demo: "Simulerat meddelande, inget Teams-kort skickades." };
}

function transferToStaff(args, now, simulateOpen, history) {
  if (countToolUses(history, "transfer_to_staff") >= DATA.office.limits.maxTransfersPerCall) {
    return { ok: false, outcome: "limit", instruction: "Erbjud att ta ett meddelande i stället." };
  }
  const s = STAFF.find((x) => x.id === args.staffId);
  if (!s) return { ok: false, outcome: "unknown_staff", instruction: "Använd resolve_staff först." };
  if (!officeState(now, simulateOpen).transfer) {
    return { ok: false, outcome: "closed", instruction: "Kontoret är stängt så samtal kan inte kopplas nu. Erbjud att boka ett möte eller ta ett meddelande." };
  }
  if (!s.transferable) {
    return { ok: false, outcome: "not_transferable", instruction: `${s.name} tar inte emot kopplade samtal. Erbjud att boka ett möte eller ta ett meddelande.` };
  }
  if (s.demoTransfer === "connected") return { ok: true, outcome: "connected", staffName: s.name };
  return { ok: false, outcome: "busy", instruction: `${s.name} är upptagen just nu. Du har samtalet tillbaka. Säg det och erbjud att ta ett meddelande eller boka ett möte.` };
}

function validHistory(messages) {
  if (!Array.isArray(messages) || messages.length > 200) return false;
  for (const m of messages) {
    if (!m || typeof m !== "object" || !["user", "assistant", "system"].includes(m.role)) return false;
    if (typeof m.content !== "string" && !Array.isArray(m.content)) return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "missing_api_key" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const history = body.messages ?? [];
  const text = str(body.text, 1000);
  if (!validHistory(history) || JSON.stringify(history).length > MAX_HISTORY_BYTES) return res.status(400).json({ error: "bad_history" });
  if (!text) return res.status(400).json({ error: "empty_text" });

  const now = new Date();
  const started = Date.parse(body.startedAt);
  const startedAt = Number.isFinite(started) && Math.abs(now - started) < 3 * 3600_000 ? new Date(started) : now;
  const simulateOpen = body.simulateOpen === true;
  let lang = body.lang === "en" ? "en" : "sv";
  const prompts = buildPrompts(startedAt, simulateOpen);

  const messages = [...history, { role: "user", content: text }];
  const segments = [];
  const events = [];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let ended = false;
  let transferredTo = null;

  if (countToolUses(history) >= DATA.office.limits.maxToolCallsPerCall) {
    return res.status(429).json({ error: "tool_limit" });
  }

  try {
    for (let loop = 0; loop < MAX_LOOPS && !ended; loop++) {
      const params = {
        model: MODEL,
        max_tokens: 4000,
        system: [{ type: "text", text: prompts.sv, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
        output_config: { effort: EFFORT },
        cache_control: { type: "ephemeral" },
      };
      if (!MODEL.startsWith("claude-haiku")) {
        params.betas = ["server-side-fallback-2026-07-01"];
        params.fallbacks = "default";
      }
      const response = await client.beta.messages.create(params);
      usage.input += response.usage.input_tokens ?? 0;
      usage.output += response.usage.output_tokens ?? 0;
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
      messages.push({ role: "assistant", content: response.content });

      for (const b of response.content) if (b.type === "text" && b.text.trim()) segments.push(b.text.trim());

      if (response.stop_reason === "refusal") {
        segments.push(lang === "sv" ? "Det kan jag tyvärr inte hjälpa till med. Vill du att jag tar ett meddelande?" : "I'm afraid I can't help with that. Would you like me to take a message?");
        break;
      }
      if (response.stop_reason !== "tool_use") break;

      const results = [];
      let switchTo = null;
      for (const b of response.content) {
        if (b.type !== "tool_use") continue;
        const args = b.input && typeof b.input === "object" ? b.input : {};
        let result;
        switch (b.name) {
          case "search_knowledge": result = searchKnowledge(args, lang); break;
          case "resolve_staff": result = resolveStaff(args); break;
          case "check_availability": result = checkAvailability(args, now); break;
          case "book_meeting": result = bookMeeting(args, now, messages); break;
          case "take_message": result = takeMessage(args, messages); break;
          case "transfer_to_staff":
            result = transferToStaff(args, now, simulateOpen, messages);
            if (result.outcome === "connected") { ended = true; transferredTo = result.staffName; }
            break;
          case "end_call": result = { ok: true }; ended = true; break;
          case "switch_to_english": switchTo = "en"; result = { ok: true }; break;
          case "switch_to_swedish": switchTo = "sv"; result = { ok: true }; break;
          default: result = { ok: false, error: "unknown_tool" };
        }
        events.push({ tool: b.name, input: args, result });
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: results });
      if (switchTo && switchTo !== lang) {
        lang = switchTo;
        messages.push({
          role: "system",
          content: lang === "en"
            ? `The caller speaks English. From now on these instructions replace the Swedish ones and you speak English only. Continue the conversation and answer the caller's last message.\n\n${prompts.en}`
            : `Uppringaren talar svenska. Från och med nu gäller dessa instruktioner och du talar bara svenska. Fortsätt samtalet och svara på uppringarens senaste replik.\n\n${prompts.sv}`,
        });
      }
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: "anthropic_auth" });
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "anthropic_rate_limit" });
    if (e instanceof Anthropic.BadRequestError) return res.status(502).json({ error: "anthropic_bad_request", detail: e.message.slice(0, 500) });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: "anthropic_error", status: e.status });
    return res.status(500).json({ error: "internal", detail: String(e?.message ?? e).slice(0, 300) });
  }

  const [pin, pout] = PRICE[MODEL] ?? [0, 0];
  const costUsd = (usage.input * pin + usage.cacheWrite * pin * 1.25 + usage.cacheRead * pin * 0.1 + usage.output * pout) / 1e6;
  return res.status(200).json({ messages, segments, events, lang, ended, transferredTo, usage, costUsd, model: MODEL });
}
