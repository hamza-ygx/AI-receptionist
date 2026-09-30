import type { z } from "zod";
import type { Logger } from "../../lib/log.js";

export interface ToolContext {
  callId: string;
  lang: "sv" | "en";
  customerNumber: string | null;
  log: Logger;
}

export type ToolOutcome = { result: string } | { error: string };

export interface ToolDef<S extends z.ZodType> {
  name: string;
  schema: S;
  perCallLimit?: number;
  run(args: z.infer<S>, ctx: ToolContext): Promise<ToolOutcome>;
}

export function ok(data: unknown): ToolOutcome {
  return { result: typeof data === "string" ? data : JSON.stringify(data) };
}

export function refuse(reason: string, instruction: string, extra: Record<string, unknown> = {}): ToolOutcome {
  return { result: JSON.stringify({ ok: false, reason, instruction, ...extra }) };
}

export function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
  return def;
}
