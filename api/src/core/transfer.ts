import { db } from "../lib/db.js";
import { canTransferNow, officeConfig, type OfficeConfig } from "../lib/office.js";
import { sameNumber } from "../lib/phone.js";

export interface TransferTarget {
  id: string;
  name: string;
  direct_phone_e164: string | null;
  transferable: boolean;
  active: boolean;
}

export type TransferStatus = "requested" | "dialing" | "connected" | "no_answer" | "busy" | "failed" | "cancelled" | "refused";

export function transferBlockReason(staff: TransferTarget | undefined, cfg: OfficeConfig, extraBlocked: string[] = []): string | null {
  if (!staff || !staff.active) return "unknown_staff";
  if (!staff.transferable) return "not_transferable";
  if (!staff.direct_phone_e164) return "no_direct_number";
  const blocked = [...cfg.blockedTransferNumbers, ...extraBlocked];
  if (blocked.some((b) => sameNumber(b, staff.direct_phone_e164!))) return "blocked_number";
  if (!canTransferNow(cfg)) return "outside_transfer_hours";
  return null;
}

export const TRANSFER_INSTRUCTIONS: Record<string, string> = {
  unknown_staff: "Unknown staff member. Use resolve_staff, or offer to take a message.",
  not_transferable: "This person does not take transferred calls. Offer to take a message or book a meeting.",
  no_direct_number: "This person cannot be reached by phone right now. Offer to take a message or book a meeting.",
  blocked_number: "Transfer is not possible. Offer to take a message or book a meeting.",
  outside_transfer_hours: "The office is closed, so calls cannot be transferred. Offer to take a message or book a meeting.",
  limit_reached: "Transfer attempts for this call are exhausted. Offer to take a message.",
};

export function systemBlockedNumbers(): string[] {
  return [process.env.TRUNK_NUMBER_E164, process.env.TWILIO_NUMBER_E164].filter((x): x is string => Boolean(x));
}

export type ApprovedTransfer =
  | { ok: true; transferId: string; staff: { id: string; name: string; phone: string } }
  | { ok: false; reason: string; instruction: string };

export async function approveTransfer(callId: string, staffId: string, reason: string, callerName: string | null, company: string | null): Promise<ApprovedTransfer> {
  const cfg = await officeConfig();
  const s = await db().query<TransferTarget>(
    "SELECT id, name, direct_phone_e164, transferable, active FROM staff WHERE id = $1",
    [staffId],
  );
  const staff = s.rows[0];
  const block = transferBlockReason(staff, cfg, systemBlockedNumbers());
  if (block) return { ok: false, reason: block, instruction: TRANSFER_INSTRUCTIONS[block]! };
  const attempts = await db().query<{ n: string }>(
    "SELECT count(*) AS n FROM transfers WHERE call_id = $1 AND status NOT IN ('refused','requested','cancelled')",
    [callId],
  );
  if (Number(attempts.rows[0]!.n) >= cfg.limits.maxTransfersPerCall) {
    return { ok: false, reason: "limit_reached", instruction: TRANSFER_INSTRUCTIONS.limit_reached! };
  }
  const r = await db().query<{ id: string }>(
    `INSERT INTO transfers (call_id, staff_id, reason, caller_name, company, status, consumed_at)
     VALUES ($1, $2, $3, $4, $5, 'dialing', now()) RETURNING id`,
    [callId, staffId, reason, callerName, company],
  );
  return { ok: true, transferId: r.rows[0]!.id, staff: { id: staff!.id, name: staff!.name, phone: staff!.direct_phone_e164! } };
}

export async function setTransferStatus(transferId: string, status: TransferStatus): Promise<void> {
  await db().query("UPDATE transfers SET status = $2, updated_at = now() WHERE id = $1", [transferId, status]);
}
