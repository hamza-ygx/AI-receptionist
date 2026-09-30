import { z } from "zod";
import { DateTime, Interval } from "luxon";
import { db } from "../../lib/db.js";
import { TZ } from "../../lib/config.js";
import { nowLocal, officeConfig } from "../../lib/office.js";
import { candidateSlots, isFree, spokenSlot, spread } from "../../lib/slots.js";
import { busyIntervals } from "../../graph/calendar.js";
import { findStaff } from "./resolveStaff.js";
import { defineTool, ok, refuse } from "./types.js";
import { optText, staffIdSchema } from "./common.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

interface BookableStaff { id: string; name: string; upn: string }

async function staffPool(staffId: string | null | undefined, topic: string | null): Promise<BookableStaff[]> {
  if (staffId) {
    const r = await db().query<BookableStaff>("SELECT id, name, upn FROM staff WHERE id = $1 AND active AND bookable AND upn IS NOT NULL", [staffId]);
    return r.rows;
  }
  if (topic) {
    const ids = (await findStaff(topic)).filter((c) => c.bookable).map((c) => c.staffId);
    if (!ids.length) return [];
    const r = await db().query<BookableStaff>("SELECT id, name, upn FROM staff WHERE id = ANY($1) AND active AND bookable AND upn IS NOT NULL", [ids]);
    return r.rows;
  }
  const r = await db().query<BookableStaff>("SELECT id, name, upn FROM staff WHERE active AND bookable AND upn IS NOT NULL ORDER BY name");
  return r.rows;
}

export async function localBusy(staffIds: string[], from: DateTime, to: DateTime): Promise<Map<string, Interval[]>> {
  const r = await db().query<{ staff_id: string; start_at: Date; end_at: Date }>(
    "SELECT staff_id, start_at, end_at FROM bookings WHERE staff_id = ANY($1) AND end_at > $2 AND start_at < $3",
    [staffIds, from.toJSDate(), to.toJSDate()],
  );
  const m = new Map<string, Interval[]>();
  for (const b of r.rows) {
    m.set(b.staff_id, [...(m.get(b.staff_id) ?? []), Interval.fromDateTimes(DateTime.fromJSDate(b.start_at), DateTime.fromJSDate(b.end_at))]);
  }
  return m;
}

export const checkAvailability = defineTool({
  name: "check_availability",
  schema: z.object({
    staffId: staffIdSchema.optional().nullable(),
    topic: optText(100),
    dateFrom: isoDate,
    dateTo: isoDate,
    durationMin: z.coerce.number().int(),
  }),
  perCallLimit: 8,
  async run(args, ctx) {
    const cfg = await officeConfig();
    if (!cfg.slotDurationsMin.includes(args.durationMin)) {
      return refuse("invalid_duration", `Allowed meeting lengths are ${cfg.slotDurationsMin.join(", ")} minutes.`);
    }
    const now = nowLocal();
    const from = DateTime.fromISO(args.dateFrom.slice(0, 10), { zone: TZ }).startOf("day");
    let to = DateTime.fromISO(args.dateTo.slice(0, 10), { zone: TZ }).endOf("day");
    if (!from.isValid || !to.isValid || to < from) return refuse("invalid_dates", "Ask the caller which days suit them.");
    if (to.diff(from, "days").days > 14) to = from.plus({ days: 14 }).endOf("day");

    const pool = await staffPool(args.staffId, args.topic);
    if (!pool.length) return refuse("no_bookable_staff", "Nobody matching can be booked. Offer to take a message instead.");

    const candidates = candidateSlots(cfg, from, to, args.durationMin, now);
    if (!candidates.length) {
      return ok({ slots: [], instruction: "No bookable times in that range (office hours, holidays or minimum notice). Suggest a later range." });
    }
    const winFrom = candidates[0]!.start.minus({ minutes: cfg.bufferMin });
    const winTo = candidates[candidates.length - 1]!.end.plus({ minutes: cfg.bufferMin });
    const [graphBusy, dbBusy] = await Promise.all([
      busyIntervals(pool.map((s) => s.upn), winFrom, winTo),
      localBusy(pool.map((s) => s.id), winFrom, winTo),
    ]);

    const free = candidates.flatMap((slot) => pool
      .filter((s) => isFree(slot, [...(graphBusy.get(s.upn.toLowerCase()) ?? []), ...(dbBusy.get(s.id) ?? [])], cfg.bufferMin))
      .slice(0, 1)
      .map((s) => ({ ...slot, staff: s })));

    const picked = spread(free, 6);
    ctx.log.info("Availability computed", { candidates: candidates.length, free: free.length, returned: picked.length });
    return ok({
      slots: picked.map((p) => ({
        staffId: p.staff.id,
        staffName: p.staff.name,
        start: p.start.toISO(),
        end: p.end.toISO(),
        spoken: spokenSlot(p.start, ctx.lang),
      })),
      instruction: picked.length
        ? "Offer at most 2–3 of these times at once. When the caller picks one, confirm the details and call book_meeting with the exact start/end values."
        : "No free times found. Suggest another date range or offer to take a message.",
    });
  },
});
