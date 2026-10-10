import { fileURLToPath } from "node:url";
import { beta, cli, defineAgent, llm, ServerOptions, voice, type JobContext, type JobProcess } from "@livekit/agents";
import * as azure from "@livekit/agents-plugin-azure";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { ParticipantKind, RoomEvent, type RemoteParticipant } from "@livekit/rtc-node";
import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { z } from "zod";
import { logger, errMsg, maskPhone } from "../../api/src/lib/log.js";
import { normalizeE164 } from "../../api/src/lib/phone.js";
import { officeConfig } from "../../api/src/lib/office.js";
import { buildVariables } from "../../api/src/core/variables.js";
import { loadPrompt, render } from "../../api/src/core/prompt.js";
import { approveTransfer, setTransferStatus, systemBlockedNumbers } from "../../api/src/core/transfer.js";
import { sameNumber } from "../../api/src/lib/phone.js";
import { analyzeTranscript } from "../../api/src/core/analysis.js";
import { ingestCall } from "../../api/src/core/ingest.js";
import { AzureTTS } from "./azureTts.js";
import { businessTools } from "./tools.js";
import { coldTransfer, warmTransfer, transferToNumber } from "./transfer.js";
import { estimateCost } from "./cost.js";
import type { CallState } from "./state.js";

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME ?? "rkjh-receptionist";
const GREETING_SV = "Välkommen till Revisionskonsulterna J Hägglund. Du pratar med en AI-assistent, och samtalet transkriberas så att vi kan hjälpa dig. Hur kan jag hjälpa dig? … If you prefer English, just say so.";
const MAX_CALL_MS = Number(process.env.MAX_CALL_SECONDS ?? 900) * 1000;

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function makeLlm() {
  const deployment = env("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-5.4-mini");
  return new openai.LLM({
    model: deployment,
    client: new AzureOpenAI({
      endpoint: env("AZURE_OPENAI_ENDPOINT"),
      deployment,
      apiVersion: env("AZURE_OPENAI_API_VERSION", "2025-04-01-preview"),
      ...(process.env.AZURE_OPENAI_API_KEY
        ? { apiKey: process.env.AZURE_OPENAI_API_KEY }
        : { azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default") }),
    }),
    reasoningEffort: (process.env.LLM_REASONING_EFFORT ?? "none") as "none",
    parallelToolCalls: false,
  });
}

function makeTts(lang: "sv" | "en"): AzureTTS {
  return new AzureTTS({
    region: env("AZURE_SPEECH_REGION", "swedencentral"),
    key: env("AZURE_SPEECH_KEY"),
    voice: lang === "sv" ? env("VOICE_SV", "sv-SE-SofieNeural") : env("VOICE_EN", "en-GB-SoniaNeural"),
    locale: lang === "sv" ? "sv-SE" : "en-GB",
  });
}

function transcriptOf(session: voice.AgentSession<CallState>): string {
  const lines: string[] = [];
  for (const item of session.history.items) {
    if (item.type !== "message" || (item.role !== "user" && item.role !== "assistant")) continue;
    const text = item.textContent?.trim();
    if (text) lines.push(`${item.role === "user" ? "Uppringare" : "AI"}: ${text}`);
  }
  return lines.join("\n");
}

class Receptionist extends voice.Agent<CallState> {
  constructor(public lang: "sv" | "en", instructions: string, tts: AzureTTS, tools: llm.ToolContextLike<CallState>, chatCtx?: llm.ChatContext) {
    super({ instructions, tts, tools, chatCtx });
  }

  override async onEnter(): Promise<void> {
    this.session.userData.lang = this.lang;
    const spoken = this.session.history.items.some((i) => i.type === "message" && (i.role === "user" || i.role === "assistant"));
    if (!spoken) {
      this.session.say(GREETING_SV, { allowInterruptions: true });
    } else if (this.lang === "en") {
      this.session.generateReply({ instructions: "The caller speaks English. Continue the conversation in English and answer their last message." });
    } else {
      this.session.generateReply({ instructions: "Uppringaren talar svenska. Fortsätt på svenska och svara på det senaste de sa." });
    }
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load({ minSilenceDuration: 0.45 });
  },

  entry: async (ctx: JobContext) => {
    const log = logger();
    await ctx.connect();
    const caller = await ctx.waitForParticipant();
    if (caller.kind !== ParticipantKind.SIP) log.warn("Non-SIP participant joined; running anyway (dev/test)");

    const callerNumber = normalizeE164(caller.attributes["sip.phoneNumber"] ?? "") ?? null;
    const state: CallState = {
      ctx,
      callId: ctx.room.name!,
      callerIdentity: caller.identity,
      callerNumber,
      lang: "sv",
      startedAt: new Date(),
      endedReason: "caller_hangup",
      transferredTo: null,
      llmPromptTokens: 0,
      llmCompletionTokens: 0,
      ttsCharacters: 0,
      log,
    };
    log.info("Call started", { room: state.callId, from: maskPhone(callerNumber) });

    const [{ vars }, cfg] = await Promise.all([buildVariables(callerNumber, log), officeConfig()]);
    const prompts = { sv: render(loadPrompt("sv"), vars), en: render(loadPrompt("en"), vars) };
    const ttsByLang = { sv: makeTts("sv"), en: makeTts("en") };

    const session = new voice.AgentSession<CallState>({
      stt: new azure.STT({
        speechKey: env("AZURE_SPEECH_KEY"),
        speechRegion: env("AZURE_SPEECH_REGION", "swedencentral"),
        language: ["sv-SE", "en-US"],
        segmentationSilenceTimeoutMs: 500,
      }),
      llm: makeLlm(),
      vad: ctx.proc.userData.vad as silero.VAD,
      userData: state,
      maxToolSteps: 6,
      turnHandling: {
        turnDetection: "vad",
        endpointing: { minDelay: 550, maxDelay: 3000 },
        interruption: { enabled: true, mode: "vad", minDuration: 0.4 },
      },
      ttsTextTransforms: ["filter_markdown", "filter_emoji"],
    });

    const toolsFor = (lang: "sv" | "en"): llm.ToolContextLike<CallState> => {
      const other = lang === "sv" ? "en" : "sv";
      return [
        ...businessTools(),
        llm.tool({
          name: lang === "sv" ? "switch_to_english" : "switch_to_swedish",
          description: lang === "sv" ? "Switch to the English-speaking receptionist when the caller speaks English or asks for English." : "Switch to the Swedish-speaking receptionist when the caller speaks Swedish or asks for Swedish.",
          execute: async () => llm.handoff({ agent: makeAgent(other), returns: `Switched to ${other}` }),
        }),
        llm.tool({
          name: "transfer_to_staff",
          description: "Transfer the caller live to a staff member. The server checks office hours and whether the person takes calls. The caller is put on hold while the colleague is asked. Returns the outcome; if not connected, offer to take a message.",
          parameters: z.object({
            staffId: z.string().describe("staffId exactly as returned by resolve_staff."),
            reason: z.string().describe("One short neutral sentence about the matter, for the colleague."),
            callerName: z.string().optional(),
            company: z.string().optional(),
          }),
          execute: async ({ staffId, reason, callerName, company }, { ctx: run }) => {
            const s = run.userData;
            const approved = await approveTransfer(s.callId, staffId, reason, callerName ?? null, company ?? null);
            if (!approved.ok) return JSON.stringify({ ok: false, reason: approved.reason, instruction: approved.instruction });
            const holdMsg = s.lang === "sv" ? "Ett ögonblick, jag försöker koppla dig." : "One moment, I'll try to connect you.";
            await run.session.say(holdMsg, { allowInterruptions: false }).waitForPlayout();
            const mode = process.env.TRANSFER_MODE === "cold" ? "cold" : "warm";
            const status = mode === "cold"
              ? await coldTransfer(s, approved.staff)
              : await warmTransfer(s, run.session, ttsByLang.sv, approved.staff, { assistantName: cfg.assistantName, callerName: callerName ?? null, company: company ?? null, reason });
            await setTransferStatus(approved.transferId, status);
            if (status === "connected") {
              s.transferredTo = approved.staff.id;
              s.endedReason = "transferred";
              void run.session.shutdown({ drain: false, reason: "transferred" });
              return JSON.stringify({ ok: true, connected: true });
            }
            return JSON.stringify({
              ok: false,
              status,
              instruction: "The colleague could not take the call. Apologise briefly and offer to take a message so they can call back.",
            });
          },
        }),
        beta.createEndCallTool<CallState>({
          endInstructions: lang === "sv" ? "Säg ett kort, vänligt hej då på svenska." : "Say a short, friendly goodbye in English.",
          deleteRoom: true,
          onToolCalled: (run) => { run.ctx.userData.endedReason = "agent_ended"; },
        }),
      ];
    };

    const makeAgent = (lang: "sv" | "en"): Receptionist =>
      new Receptionist(lang, prompts[lang], ttsByLang[lang], toolsFor(lang), session.history.copy());

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      if (!ev.isFinal || !ev.language) return;
      const detected = ev.language.toLowerCase().startsWith("en") ? "en" : ev.language.toLowerCase().startsWith("sv") ? "sv" : null;
      const current = (session.currentAgent as Receptionist | undefined)?.lang;
      if (detected && current && detected !== current && ev.transcript.trim().split(/\s+/).length >= 2) {
        session.updateAgent(makeAgent(detected));
      }
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      if (ev.item.type === "message" && ev.item.role === "assistant") state.ttsCharacters += ev.item.textContent?.length ?? 0;
    });

    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      const m = ev.metrics as { type?: string; promptTokens?: number; completionTokens?: number };
      if (m.type === "llm_metrics") {
        state.llmPromptTokens += m.promptTokens ?? 0;
        state.llmCompletionTokens += m.completionTokens ?? 0;
      }
    });

    session.on(voice.AgentSessionEventTypes.Close, (ev) => {
      if (!ev.error || state.transferredTo) return;
      state.endedReason = "agent_error";
      log.error("Session closed on unrecoverable error", { err: errMsg(ev.error) });
      const fallback = normalizeE164(process.env.FALLBACK_TRANSFER_NUMBER ?? "");
      const blocked = [...cfg.blockedTransferNumbers, ...systemBlockedNumbers()];
      if (fallback && !blocked.some((n) => sameNumber(n, fallback))) {
        state.endedReason = "agent_error_fallback_transfer";
        void transferToNumber(state, fallback).then((ok) => { if (!ok) void ctx.deleteRoom().catch(() => undefined); });
      } else {
        void ctx.deleteRoom().catch(() => undefined);
      }
    });

    const maxTimer = setTimeout(() => {
      state.endedReason = "max_duration";
      const bye = state.lang === "sv" ? "Vi behöver tyvärr avsluta samtalet nu. Tack för att du ringde!" : "We need to end the call now. Thank you for calling!";
      session.say(bye, { allowInterruptions: false }).waitForPlayout().finally(() => void ctx.deleteRoom());
    }, MAX_CALL_MS);

    ctx.room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      if (p.identity === state.callerIdentity || (state.transferredTo && p.kind === ParticipantKind.SIP)) {
        void ctx.deleteRoom().catch(() => undefined);
      }
    });

    ctx.addShutdownCallback(async () => {
      clearTimeout(maxTimer);
      const endedAt = new Date();
      const transcript = transcriptOf(session);
      try {
        const analysis = await analyzeTranscript(transcript).catch((e) => {
          log.error("Call analysis failed", { err: errMsg(e) });
          return { summarySv: null, fields: { callerName: null, company: null, callbackNumber: null, reason: null, language: null, outcome: null, urgency: null } };
        });
        const cost = estimateCost(state, endedAt);
        const outcome = await ingestCall({
          callId: state.callId,
          startedAt: state.startedAt,
          endedAt,
          language: state.lang,
          callerNumber: state.callerNumber,
          transcript,
          summarySv: analysis.summarySv,
          fields: analysis.fields,
          endedReason: state.endedReason,
          costTotal: cost.total,
          costBreakdown: cost.breakdown,
        }, log);
        log.info("Call ingested", { outcome, seconds: Math.round((endedAt.getTime() - state.startedAt.getTime()) / 1000) });
      } catch (e) {
        log.error("Call ingest failed", { err: errMsg(e) });
      }
    });

    await session.start({
      agent: makeAgent("sv"),
      room: ctx.room,
      inputOptions: { participantIdentity: caller.identity, closeOnDisconnect: false },
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
