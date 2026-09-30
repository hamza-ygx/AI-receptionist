import { db } from "../../lib/db.js";
import type { StatusUpdateT } from "./types.js";

export async function handleStatusUpdate(msg: StatusUpdateT): Promise<void> {
  const callId = msg.call?.id;
  if (!callId || msg.status !== "forwarding") return;
  await db().query(
    `UPDATE transfers SET status = 'dialing', updated_at = now()
      WHERE id = (SELECT id FROM transfers WHERE call_id = $1 AND status IN ('dialing','requested') ORDER BY created_at DESC LIMIT 1)`,
    [callId],
  );
}
