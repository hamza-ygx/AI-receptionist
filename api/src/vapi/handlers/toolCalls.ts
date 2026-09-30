import type { z } from "zod";
import { officeConfig } from "../../lib/office.js";
import { db } from "../../lib/db.js";
import { errMsg, type Logger } from "../../lib/log.js";
import { normalizeE164 } from "../../lib/phone.js";
import { TOOLS } from "../tools/index.js";
import { bumpToolCount, totalToolCount } from "../tools/limits.js";
import type { ToolsCallsMessageT } from "./types.js";
import { langOf } from "./common.js";

interface Result { toolCallId: string; name: string; result?: string; error?: string }

const TECH_ERROR = JSON.stringify({
  ok: false,
  reason: "technical_error",
  instruction: "A technical problem occurred. Apologise briefly and offer to take a message instead. Do not retry more than once.",
});

function parseArgs(raw: unknown): unknown {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw ?? {};
}

function zodSummary(e: z.ZodError): string {
  return e.issues.slice(0, 5).map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ");
}

export async function handleToolCalls(msg: ToolsCallsMessageT, log: Logger): Promise<{ results: Result[] }> {
  const callId = msg.call.id;
  const lang = langOf(msg.assistant?.name);
  const customerNumber = normalizeE164(msg.call.customer?.number ?? "") ?? null;
  const cfg = await officeConfig();

  const results: Result[] = [];
  for (const tc of msg.toolCallList) {
    const client = await db().connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [`toolcall:${tc.id}`]);
      const cached = await client.query<{ result: Result }>("SELECT result FROM tool_call_results WHERE tool_call_id = $1", [tc.id]);
      if (cached.rows[0]) {
        log.info("Duplicate tool call delivery served from cache", { tool: tc.function.name });
        results.push(cached.rows[0].result);
        continue;
      }
      const r = await runOne(tc, callId, lang, customerNumber, cfg.limits.maxToolCallsPerCall, log);
      await client.query(
        "INSERT INTO tool_call_results (tool_call_id, call_id, result) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [tc.id, callId, JSON.stringify(r)],
      );
      results.push(r);
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`toolcall:${tc.id}`]).catch(() => undefined);
      client.release();
    }
  }
  return { results };
}

async function runOne(
  tc: ToolsCallsMessageT["toolCallList"][number],
  callId: string,
  lang: "sv" | "en",
  customerNumber: string | null,
  maxToolCalls: number,
  log: Logger,
): Promise<Result> {
  const name = tc.function.name;
  const tool = TOOLS[name];
  if (!tool) return { toolCallId: tc.id, name, error: `Unknown tool ${name}` };
  try {
    if ((await totalToolCount(callId)) >= maxToolCalls) {
      return { toolCallId: tc.id, name, result: JSON.stringify({ ok: false, reason: "call_limit", instruction: "Offer to take a message and end the call politely." }) };
    }
    const n = await bumpToolCount(callId, name);
    if (tool.perCallLimit && n > tool.perCallLimit) {
      return { toolCallId: tc.id, name, result: JSON.stringify({ ok: false, reason: "tool_limit", instruction: "Stop using this tool in this call. Offer to take a message." }) };
    }
    const parsed = tool.schema.safeParse(parseArgs(tc.function.arguments));
    if (!parsed.success) {
      return { toolCallId: tc.id, name, result: JSON.stringify({ ok: false, reason: "invalid_arguments", detail: zodSummary(parsed.error), instruction: "Ask the caller for the missing or unclear information, then try again." }) };
    }
    const started = Date.now();
    const out = await tool.run(parsed.data, { callId, lang, customerNumber, log });
    log.info("Tool call", { tool: name, ms: Date.now() - started });
    return { toolCallId: tc.id, name, ...out };
  } catch (e) {
    log.error("Tool failed", { tool: name, err: errMsg(e) });
    return { toolCallId: tc.id, name, result: TECH_ERROR };
  }
}
