import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { errMsg, logger } from "../lib/log.js";
import { db } from "../lib/db.js";
import { verifyVapiRequest } from "./auth.js";
import { CallDeletedMessage, EndOfCallReport, Envelope, StatusUpdateMessage, ToolCallsMessage } from "./schemas.js";
import { handleToolCalls } from "./handlers/toolCalls.js";
import { handleAssistantRequest } from "./handlers/assistantRequest.js";
import { handleTransferDestinationRequest } from "./handlers/transferDestination.js";
import { handleEndOfCallReport } from "./handlers/endOfCall.js";
import { handleStatusUpdate } from "./handlers/status.js";
import { langOf } from "./handlers/common.js";

const MAX_BODY = 2_000_000;

function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

export async function vapiEvents(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const log = logger(ctx);
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return json(413, { error: "too_large" });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too_large" });

  const auth = verifyVapiRequest(req.headers, raw);
  if (!auth.ok) {
    log.warn("Rejected Vapi webhook", { cause: auth.reason });
    return json(401, { error: "unauthorized" });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const env = Envelope.safeParse(body);
  if (!env.success) return json(400, { error: "invalid_envelope" });
  const message = env.data.message;
  const type = message.type;

  try {
    switch (type) {
      case "assistant-request": {
        const number = message.call?.customer?.number ?? message.customer?.number;
        return json(200, await handleAssistantRequest(number, log));
      }
      case "tool-calls": {
        const parsed = ToolCallsMessage.safeParse(message);
        if (!parsed.success) return json(200, { error: "invalid tool-calls payload" });
        return json(200, await handleToolCalls(parsed.data, log));
      }
      case "transfer-destination-request":
        return json(200, await handleTransferDestinationRequest(message.call?.id, langOf(message.assistant?.name), log));
      case "end-of-call-report": {
        const parsed = EndOfCallReport.safeParse(message);
        if (!parsed.success) {
          log.error("Invalid end-of-call-report", { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join(".")) });
          return json(400, { error: "invalid_report" });
        }
        await handleEndOfCallReport(parsed.data, log);
        return json(200, { ok: true });
      }
      case "status-update": {
        const parsed = StatusUpdateMessage.safeParse(message);
        if (parsed.success) await handleStatusUpdate(parsed.data);
        return json(200, { ok: true });
      }
      case "call.deleted":
      case "call.delete.failed": {
        const parsed = CallDeletedMessage.safeParse(message);
        const id = parsed.success ? (parsed.data.call?.id ?? parsed.data.callId) : undefined;
        if (id) {
          await db().query(
            type === "call.deleted"
              ? "UPDATE vapi_deletions SET confirmed_at = now() WHERE call_id = $1"
              : "UPDATE vapi_deletions SET last_error = 'call.delete.failed', next_attempt_at = now() + interval '10 minutes' WHERE call_id = $1",
            [id],
          );
          if (type === "call.deleted") await db().query("UPDATE calls SET vapi_deleted_at = now() WHERE id = $1", [id]);
        }
        return json(200, { ok: true });
      }
      default:
        return json(200, { ok: true, ignored: type });
    }
  } catch (e) {
    log.error("Vapi event handling failed", { type, err: errMsg(e) });
    if (type === "end-of-call-report") return json(500, { error: "ingest_failed" });
    if (type === "assistant-request") return json(200, await handleAssistantRequest(null, log).catch(() => ({ error: "Tekniskt fel, försök igen senare." })));
    return json(200, { error: "internal_error" });
  }
}
