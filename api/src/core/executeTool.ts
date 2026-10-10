import type { z } from "zod";
import { db } from "../lib/db.js";
import { officeConfig } from "../lib/office.js";
import { errMsg, type Logger } from "../lib/log.js";
import { TOOLS } from "../tools/index.js";
import { bumpToolCount, totalToolCount } from "../tools/limits.js";

export interface ToolInvocation {
  callId: string;
  toolCallId: string;
  name: string;
  args: unknown;
  lang: "sv" | "en";
  customerNumber: string | null;
  log: Logger;
}

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

async function runOne(inv: ToolInvocation, maxToolCalls: number): Promise<string> {
  const tool = TOOLS[inv.name];
  if (!tool) return JSON.stringify({ ok: false, reason: "unknown_tool" });
  try {
    if ((await totalToolCount(inv.callId)) >= maxToolCalls) {
      return JSON.stringify({ ok: false, reason: "call_limit", instruction: "Offer to take a message and end the call politely." });
    }
    const n = await bumpToolCount(inv.callId, inv.name);
    if (tool.perCallLimit && n > tool.perCallLimit) {
      return JSON.stringify({ ok: false, reason: "tool_limit", instruction: "Stop using this tool in this call. Offer to take a message." });
    }
    const parsed = tool.schema.safeParse(parseArgs(inv.args));
    if (!parsed.success) {
      return JSON.stringify({ ok: false, reason: "invalid_arguments", detail: zodSummary(parsed.error), instruction: "Ask the caller for the missing or unclear information, then try again." });
    }
    const started = Date.now();
    const out = await tool.run(parsed.data, { callId: inv.callId, lang: inv.lang, customerNumber: inv.customerNumber, log: inv.log });
    inv.log.info("Tool call", { tool: inv.name, ms: Date.now() - started });
    return "result" in out ? out.result : JSON.stringify({ ok: false, error: out.error });
  } catch (e) {
    inv.log.error("Tool failed", { tool: inv.name, err: errMsg(e) });
    return TECH_ERROR;
  }
}

export async function executeTool(inv: ToolInvocation): Promise<string> {
  const cfg = await officeConfig();
  const client = await db().connect();
  const lockKey = `toolcall:${inv.callId}:${inv.toolCallId}`;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
    const cached = await client.query<{ result: { result: string } }>(
      "SELECT result FROM tool_call_results WHERE tool_call_id = $1 AND call_id = $2",
      [inv.toolCallId, inv.callId],
    );
    if (cached.rows[0]) {
      inv.log.info("Duplicate tool call served from cache", { tool: inv.name });
      return cached.rows[0].result.result;
    }
    const result = await runOne(inv, cfg.limits.maxToolCallsPerCall);
    await client.query(
      "INSERT INTO tool_call_results (tool_call_id, call_id, result) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [inv.toolCallId, inv.callId, JSON.stringify({ result })],
    );
    return result;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined);
    client.release();
  }
}
