import { z } from "zod";
import { db } from "../../lib/db.js";
import { officeConfig, canTransferNow, type OfficeConfig } from "../../lib/office.js";
import { sameNumber } from "../../lib/phone.js";
import { defineTool, ok, refuse } from "./types.js";
import { optText, staffIdSchema, text } from "./common.js";

export interface TransferTarget {
  id: string;
  name: string;
  direct_phone_e164: string | null;
  transferable: boolean;
  active: boolean;
}

export function transferBlockReason(staff: TransferTarget | undefined, cfg: OfficeConfig, twilioNumber?: string | null): string | null {
  if (!staff || !staff.active) return "unknown_staff";
  if (!staff.transferable) return "not_transferable";
  if (!staff.direct_phone_e164) return "no_direct_number";
  const blocked = [...cfg.blockedTransferNumbers, ...(twilioNumber ? [twilioNumber] : [])];
  if (blocked.some((b) => sameNumber(b, staff.direct_phone_e164!))) return "blocked_number";
  if (!canTransferNow(cfg)) return "outside_transfer_hours";
  return null;
}

const INSTRUCTIONS: Record<string, string> = {
  unknown_staff: "Unknown staff member. Use resolve_staff, or offer to take a message.",
  not_transferable: "This person does not take transferred calls. Offer to take a message or book a meeting.",
  no_direct_number: "This person cannot be reached by phone right now. Offer to take a message or book a meeting.",
  blocked_number: "Transfer is not possible. Offer to take a message or book a meeting.",
  outside_transfer_hours: "The office is closed, so calls cannot be transferred. Offer to take a message or book a meeting.",
  limit_reached: "Transfer attempts for this call are exhausted. Offer to take a message.",
};

export const transferToStaff = defineTool({
  name: "transfer_to_staff",
  schema: z.object({
    staffId: staffIdSchema,
    reason: text(1, 300),
    callerName: optText(100),
    company: optText(150),
  }),
  async run(args, ctx) {
    const cfg = await officeConfig();
    const s = await db().query<TransferTarget>(
      "SELECT id, name, direct_phone_e164, transferable, active FROM staff WHERE id = $1",
      [args.staffId],
    );
    const staff = s.rows[0];
    const block = transferBlockReason(staff, cfg, process.env.TWILIO_NUMBER_E164);
    if (block) return refuse(block, INSTRUCTIONS[block]!);

    const attempts = await db().query<{ n: string }>(
      "SELECT count(*) AS n FROM transfers WHERE call_id = $1 AND status <> 'refused'",
      [ctx.callId],
    );
    if (Number(attempts.rows[0]!.n) >= cfg.limits.maxTransfersPerCall) return refuse("limit_reached", INSTRUCTIONS.limit_reached!);

    await db().query(
      `UPDATE transfers SET status = 'cancelled', updated_at = now()
        WHERE call_id = $1 AND status = 'requested' AND consumed_at IS NULL`,
      [ctx.callId],
    );
    await db().query(
      `INSERT INTO transfers (call_id, staff_id, reason, caller_name, company, status) VALUES ($1, $2, $3, $4, $5, 'requested')`,
      [ctx.callId, args.staffId, args.reason, args.callerName, args.company],
    );
    return ok({
      ok: true,
      staffName: staff!.name,
      instruction: "Tell the caller you will try to connect them now and that they may hear a short wait, then immediately call the transferCall tool. If the transfer fails you will be back with the caller: then offer to take a message.",
    });
  },
});
