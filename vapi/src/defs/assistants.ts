import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SyncEnv } from "../env.js";

export const PROMPT_VERSION = "v1";
const promptsDir = join(dirname(fileURLToPath(import.meta.url)), "../../prompts");

function prompt(lang: "sv" | "en"): string {
  return readFileSync(join(promptsDir, lang, `system.${PROMPT_VERSION}.md`), "utf8");
}

export const DISCLOSURE_SV =
  "Välkommen till Revisionskonsulterna J Hägglund. Du pratar med en AI-assistent, och samtalet transkriberas så att vi kan hjälpa dig. Hur kan jag hjälpa dig? … If you prefer English, just say so.";
export const DISCLOSURE_EN =
  "Welcome to Revisionskonsulterna J Hägglund. You are speaking with an AI assistant, and the call is transcribed so that we can help you. How can I help you?";

type ToolIds = Record<string, string>;

function base(env: SyncEnv, lang: "sv" | "en", toolIds: ToolIds, soIds: string[]) {
  const shared = ["search_knowledge", "resolve_staff", "check_availability", "book_meeting", "transfer_to_staff", "take_message", "transferCall", "endCall"];
  const handoff = lang === "sv" ? "handoff_to_en" : "handoff_to_sv";
  return {
    name: lang === "sv" ? "rkjh-sv" : "rkjh-en",
    firstMessageMode: "assistant-speaks-first",
    firstMessageInterruptionsEnabled: false,
    transcriber: { provider: "azure", language: lang === "sv" ? "sv-SE" : "en-GB", segmentationStrategy: "Semantic" },
    voice: { provider: "azure", voiceId: lang === "sv" ? env.voiceSv : env.voiceEn, cachingEnabled: true },
    model: {
      provider: "openai",
      model: env.llmModel,
      temperature: 0.2,
      maxTokens: 400,
      reasoningEffort: "none",
      messages: [{ role: "system", content: prompt(lang) }],
      toolIds: [...shared, handoff].map((n) => {
        const id = toolIds[n];
        if (!id) throw new Error(`Tool ${n} has no id yet`);
        return id;
      }),
    },
    credentialIds: [env.azureOpenAICredentialId, env.azureSpeechCredentialId],
    server: { url: `${env.apiBase}/api/vapi/events`, credentialId: env.webhookCredentialId, timeoutSeconds: 15 },
    serverMessages: ["end-of-call-report", "status-update", "tool-calls", "transfer-destination-request"],
    clientMessages: [],
    artifactPlan: {
      recordingEnabled: false,
      videoRecordingEnabled: false,
      loggingEnabled: false,
      pcapEnabled: false,
      transcriptPlan: { enabled: true, assistantName: "AI", userName: lang === "sv" ? "Uppringare" : "Caller" },
      structuredOutputIds: soIds,
    },
    backgroundSpeechDenoisingPlan: { smartDenoisingPlan: { enabled: true } },
    startSpeakingPlan: { waitSeconds: 0.4 },
    stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.3, backoffSeconds: 1 },
    maxDurationSeconds: 900,
    endCallMessage: lang === "sv" ? "Tack för samtalet, ha en fin dag!" : "Thank you for calling, have a nice day!",
    metadata: { promptVersion: PROMPT_VERSION, env: env.name },
  };
}

export function assistantDefs(env: SyncEnv, toolIds: ToolIds, soIds: string[]): Record<string, object> {
  return {
    "rkjh-sv": { ...base(env, "sv", toolIds, soIds), firstMessage: DISCLOSURE_SV },
    "rkjh-en": {
      ...base(env, "en", toolIds, soIds),
      firstMessage: "Of course, let's continue in English. How can I help you?",
    },
  };
}

export function squadDef(assistantIds: Record<string, string>) {
  return {
    name: "rkjh-reception",
    members: [
      { assistantId: assistantIds["rkjh-sv"] },
      { assistantId: assistantIds["rkjh-en"] },
    ],
  };
}

export function phoneNumberDef(env: SyncEnv, create: boolean) {
  if (!env.twilio) return null;
  if (env.fallbackNumber && env.blockedNumbers.includes(env.fallbackNumber)) {
    throw new Error("VAPI_FALLBACK_NUMBER is on the blocked list (would loop back to the AI)");
  }
  return {
    provider: "twilio",
    name: `rkjh-${env.name}`,
    ...(create ? { number: env.twilio.number } : {}),
    twilioAccountSid: env.twilio.accountSid,
    twilioApiKey: env.twilio.apiKey,
    twilioApiSecret: env.twilio.apiSecret,
    smsEnabled: false,
    server: { url: `${env.apiBase}/api/vapi/events`, credentialId: env.webhookCredentialId, timeoutSeconds: 7 },
    ...(env.fallbackNumber ? { fallbackDestination: { type: "number", number: env.fallbackNumber, message: "" } } : {}),
  };
}
