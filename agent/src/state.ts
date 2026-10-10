import type { JobContext } from "@livekit/agents";
import type { Logger } from "../../api/src/lib/log.js";

export interface CallState {
  ctx: JobContext;
  callId: string;
  callerIdentity: string;
  callerNumber: string | null;
  lang: "sv" | "en";
  startedAt: Date;
  endedReason: string;
  transferredTo: string | null;
  llmPromptTokens: number;
  llmCompletionTokens: number;
  ttsCharacters: number;
  log: Logger;
}
