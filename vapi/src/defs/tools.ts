import type { SyncEnv } from "../env.js";

const sv = (text: string) => ({ type: "text", text, language: "sv" });
const en = (text: string) => ({ type: "text", text, language: "en" });

function server(env: SyncEnv, timeoutSeconds = 15) {
  return { url: `${env.apiBase}/api/vapi/events`, credentialId: env.webhookCredentialId, timeoutSeconds };
}

function fn(env: SyncEnv, name: string, description: string, parameters: object, messages: object[] = [], timeoutSeconds = 15) {
  return {
    type: "function",
    async: false,
    function: { name, description, parameters, strict: false },
    server: server(env, timeoutSeconds),
    messages: [
      { type: "request-response-delayed", timingMilliseconds: 2500, contents: [sv("Ett ögonblick bara."), en("Just a moment.")] },
      { type: "request-failed", contents: [sv("Förlåt, något gick fel hos mig. Jag kan ta ett meddelande istället."), en("Sorry, something went wrong on my side. I can take a message instead.")] },
      ...messages,
    ],
  };
}

const staffId = { type: "string", description: "staffId exactly as returned by resolve_staff or check_availability. Never invent one." };

export function toolDefs(env: SyncEnv): Record<string, object> {
  return {
    search_knowledge: fn(env, "search_knowledge",
      "Search RKJH's approved FAQ and website content. Use for any factual question about the firm (services, office, hours, how things work). Never answer factual questions about RKJH from memory.",
      {
        type: "object",
        properties: {
          query: { type: "string", description: "Short search query in the caller's language." },
          lang: { type: "string", enum: ["sv", "en"] },
        },
        required: ["query"],
      }),

    resolve_staff: fn(env, "resolve_staff",
      "Find a staff member by (part of) name, or the right consultant for a topic such as bokslut, deklaration, lön, revision, moms. Returns staffId, name, role, and whether they can be transferred to or booked.",
      { type: "object", properties: { nameOrTopic: { type: "string" } }, required: ["nameOrTopic"] }),

    check_availability: fn(env, "check_availability",
      "Get free meeting times. Give staffId if the caller wants a specific person, otherwise topic. Dates are ISO dates (YYYY-MM-DD) in Swedish time; range max 14 days.",
      {
        type: "object",
        properties: {
          staffId,
          topic: { type: "string" },
          dateFrom: { type: "string", description: "YYYY-MM-DD" },
          dateTo: { type: "string", description: "YYYY-MM-DD" },
          durationMin: { type: "integer", description: "Meeting length in minutes: 30 or 60. Default 30 unless the caller asks for longer." },
        },
        required: ["dateFrom", "dateTo", "durationMin"],
      },
      [{ type: "request-start", blocking: false, contents: [sv("Jag tittar i kalendern, ett ögonblick."), en("Let me check the calendar, one moment.")] }],
      20),

    book_meeting: fn(env, "book_meeting",
      "Book a meeting in a consultant's calendar. Only after the caller has chosen a slot from check_availability AND you have read back and confirmed name, company, phone number, date, time and meeting type.",
      {
        type: "object",
        properties: {
          staffId,
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
      [{ type: "request-start", blocking: false, contents: [sv("Jag bokar det nu."), en("I'm booking that now.")] }],
      25),

    transfer_to_staff: fn(env, "transfer_to_staff",
      "Request a live transfer to a staff member. The server checks office hours and whether the person can take calls. If it returns ok, immediately call transferCall. If refused, follow the returned instruction.",
      {
        type: "object",
        properties: {
          staffId,
          reason: { type: "string", description: "One short neutral sentence about the matter, for the consultant." },
          callerName: { type: "string" },
          company: { type: "string" },
        },
        required: ["staffId", "reason"],
      }),

    take_message: fn(env, "take_message",
      "Leave a message for a consultant (or reception if no staffId). Use for callbacks, reschedule/cancel requests, specific questions, and when transfer/booking isn't possible. Confirm name, company, phone and reason first.",
      {
        type: "object",
        properties: {
          staffId,
          callerName: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          reason: { type: "string", description: "What the caller wants, in neutral words. No advice." },
          urgency: { type: "string", enum: ["low", "normal", "high"] },
        },
        required: ["callerName", "phone", "reason", "urgency"],
      }),

    transferCall: {
      type: "transferCall",
      messages: [
        { type: "request-start", contents: [sv("Jag kopplar dig nu, ett ögonblick."), en("I'm connecting you now, one moment.")] },
        { type: "request-failed", contents: [sv("Det gick inte att koppla samtalet. Jag kan ta ett meddelande."), en("I couldn't connect the call. I can take a message.")] },
      ],
    },

    endCall: {
      type: "endCall",
      rejectionPlan: {
        conditions: [{
          type: "regex",
          regex: "(?i)(hej ?då|tack så mycket|tack för hjälpen|nej tack|ha det bra|det var allt|det var bra så|\\bbye\\b|goodbye|thank you|thanks|that's all)",
          target: { position: -1, role: "user" },
          negate: true,
        }],
      },
    },

    handoff_to_en: {
      type: "handoff",
      function: { name: "handoff_to_english", description: "Switch to the English-speaking assistant. Use when the caller speaks English or asks for English." },
      destinations: [{ type: "assistant", assistantName: "rkjh-en", description: "English-speaking receptionist" }],
    },

    handoff_to_sv: {
      type: "handoff",
      function: { name: "handoff_to_swedish", description: "Switch to the Swedish-speaking assistant. Use when the caller speaks Swedish or asks for Swedish." },
      destinations: [{ type: "assistant", assistantName: "rkjh-sv", description: "Swedish-speaking receptionist" }],
    },
  };
}
