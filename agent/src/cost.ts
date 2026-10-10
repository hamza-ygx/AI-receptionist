import type { CallState } from "./state.js";

function price(name: string): number | null {
  const v = process.env[name];
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function estimateCost(s: CallState, endedAt: Date): { total: number | null; breakdown: Record<string, unknown> | null } {
  const minutes = (endedAt.getTime() - s.startedAt.getTime()) / 60_000;
  const parts = {
    stt: price("COST_STT_PER_MIN"),
    tts: price("COST_TTS_PER_MILLION_CHARS"),
    llmIn: price("COST_LLM_INPUT_PER_MILLION_TOKENS"),
    llmOut: price("COST_LLM_OUTPUT_PER_MILLION_TOKENS"),
    phone: price("COST_PHONE_PER_MIN"),
  };
  if (Object.values(parts).every((p) => p === null)) return { total: null, breakdown: null };
  const breakdown = {
    stt: (parts.stt ?? 0) * minutes,
    tts: ((parts.tts ?? 0) * s.ttsCharacters) / 1e6,
    llm: ((parts.llmIn ?? 0) * s.llmPromptTokens + (parts.llmOut ?? 0) * s.llmCompletionTokens) / 1e6,
    transport: (parts.phone ?? 0) * minutes,
    minutes: Math.round(minutes * 100) / 100,
    llmPromptTokens: s.llmPromptTokens,
    llmCompletionTokens: s.llmCompletionTokens,
    ttsCharacters: s.ttsCharacters,
  };
  return { total: Math.round((breakdown.stt + breakdown.tts + breakdown.llm + breakdown.transport) * 10000) / 10000, breakdown };
}
