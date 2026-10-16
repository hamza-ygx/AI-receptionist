import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import { executeTool } from "../../api/src/core/executeTool.js";
import type { CallState } from "./state.js";

type Opts = llm.ToolOptions<CallState>;

async function withTyping<T>(state: CallState, fn: () => Promise<T>): Promise<T> {
  const typing = state.bg?.play({ source: voice.BuiltinAudioClip.KEYBOARD_TYPING, volume: 0.25 }, true);
  try {
    return await fn();
  } finally {
    typing?.stop();
  }
}

async function run(name: string, args: unknown, { ctx, toolCallId }: Opts): Promise<string> {
  const s = ctx.userData;
  return executeTool({ callId: s.callId, toolCallId, name, args, lang: s.lang, customerNumber: s.callerNumber, log: s.log });
}

const staffId = z.string().describe("staffId exactly as returned by resolve_staff or check_availability. Never invent one.");

export function businessTools() {
  return [
    llm.tool({
      name: "search_knowledge",
      description: "Search RKJH's approved FAQ and website content. Use for any factual question about the firm (services, office, hours, how things work). Never answer factual questions about RKJH from memory.",
      parameters: z.object({
        query: z.string().describe("Short search query in the caller's language."),
        lang: z.enum(["sv", "en"]).optional(),
      }),
      execute: (args, opts: Opts) => run("search_knowledge", args, opts),
    }),
    llm.tool({
      name: "resolve_staff",
      description: "Find a staff member by (part of) name, or the right consultant for a topic such as bokslut, deklaration, lön, revision, moms. Returns staffId, name, role, and whether they can be transferred to or booked.",
      parameters: z.object({ nameOrTopic: z.string() }),
      execute: (args, opts: Opts) => run("resolve_staff", args, opts),
    }),
    llm.tool({
      name: "check_availability",
      description: "Get free meeting times. Give staffId if the caller wants a specific person, otherwise topic. Dates are ISO dates (YYYY-MM-DD) in Swedish time; range max 14 days.",
      parameters: z.object({
        staffId: staffId.optional(),
        topic: z.string().optional(),
        dateFrom: z.string().describe("YYYY-MM-DD"),
        dateTo: z.string().describe("YYYY-MM-DD"),
        durationMin: z.number().int().describe("Meeting length in minutes: 30 or 60. Default 30 unless the caller asks for longer."),
      }),
      execute: async (args, opts: Opts) => {
        const msg = opts.ctx.userData.lang === "sv" ? "Jag tittar i kalendern, ett ögonblick." : "Let me check the calendar, one moment.";
        return opts.ctx.filler(msg, { delay: 1200 }, () => withTyping(opts.ctx.userData, () => run("check_availability", args, opts)));
      },
    }),
    llm.tool({
      name: "book_meeting",
      description: "Book a meeting in a consultant's calendar. Only after the caller has chosen a slot from check_availability AND you have read back and confirmed name, company, phone number, date, time and meeting type.",
      parameters: z.object({
        staffId,
        start: z.string().describe("Exact 'start' value from check_availability."),
        end: z.string().describe("Exact 'end' value from check_availability."),
        callerName: z.string(),
        company: z.string().optional(),
        phone: z.string().describe("Confirmed callback number."),
        email: z.string().optional().describe("Only if the caller gave and confirmed it (spelled back). Needed to send a Teams invite."),
        topic: z.string().describe("Short neutral description of what the meeting is about."),
        meetingType: z.enum(["phone", "teams", "office"]),
      }),
      execute: async (args, opts: Opts) => {
        const msg = opts.ctx.userData.lang === "sv" ? "Jag bokar det nu." : "I'm booking that now.";
        return opts.ctx.filler(msg, { delay: 1200 }, () => withTyping(opts.ctx.userData, () => run("book_meeting", args, opts)));
      },
    }),
    llm.tool({
      name: "take_message",
      description: "Leave a message for a consultant (or reception if no staffId). Use for callbacks, reschedule/cancel requests, specific questions, and when transfer/booking isn't possible. Confirm name, company, phone and reason first.",
      parameters: z.object({
        staffId: staffId.optional(),
        callerName: z.string(),
        company: z.string().optional(),
        phone: z.string(),
        reason: z.string().describe("What the caller wants, in neutral words. No advice."),
        urgency: z.enum(["low", "normal", "high"]),
      }),
      execute: (args, opts: Opts) => run("take_message", args, opts),
    }),
  ];
}
