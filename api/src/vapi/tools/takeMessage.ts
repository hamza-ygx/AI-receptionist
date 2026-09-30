import { z } from "zod";
import { db } from "../../lib/db.js";
import { normalizeE164, spokenSwedish } from "../../lib/phone.js";
import { officeConfig } from "../../lib/office.js";
import { errMsg } from "../../lib/log.js";
import { postMessage } from "../../teams/notify.js";
import { defineTool, ok, refuse } from "./types.js";
import { optText, staffIdSchema, text, urgencySchema } from "./common.js";
import { bumpToolCount } from "./limits.js";

export const takeMessage = defineTool({
  name: "take_message",
  schema: z.object({
    staffId: staffIdSchema.optional().nullable(),
    callerName: text(1, 100),
    company: optText(150),
    phone: text(5, 30),
    reason: text(1, 1000),
    urgency: urgencySchema.default("normal"),
  }),
  async run(args, ctx) {
    const cfg = await officeConfig();
    const phone = normalizeE164(args.phone);
    if (!phone) return refuse("invalid_phone", "The phone number is not valid. Ask the caller to repeat it digit by digit.");

    let staffId: string | null = null;
    if (args.staffId) {
      const s = await db().query("SELECT id FROM staff WHERE id = $1 AND active", [args.staffId]);
      if (!s.rowCount) return refuse("unknown_staff", "Unknown staff id. Use resolve_staff first, or omit staffId to leave the message for reception.");
      staffId = args.staffId;
    }

    if ((await bumpToolCount(ctx.callId, "take_message:ok")) > cfg.limits.maxMessagesPerCall) {
      return refuse("limit_reached", "The maximum number of messages for this call has been reached. Tell the caller the message is already registered.");
    }

    const r = await db().query<{ id: string }>(
      `INSERT INTO messages (call_id, staff_id, caller_name, company, phone_e164, reason, urgency, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [ctx.callId, staffId, args.callerName, args.company, phone, args.reason, args.urgency, ctx.lang],
    );
    const messageId = r.rows[0]!.id;

    if (args.urgency === "high") {
      postMessage(messageId, ctx.log).catch((e) => ctx.log.error("Urgent Teams post failed", { err: errMsg(e) }));
    }

    return ok({
      ok: true,
      messageId,
      readBack: { callerName: args.callerName, company: args.company, phone: spokenSwedish(phone) },
      instruction: "Confirm to the caller that the message has been registered and that a consultant will get back to them. Do not promise a specific time.",
    });
  },
});
