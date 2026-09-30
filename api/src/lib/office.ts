import { DateTime, Interval } from "luxon";
import Holidays from "date-holidays";
import { z } from "zod";
import { db } from "./db.js";
import { TZ } from "./config.js";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ranges = z.array(z.tuple([hhmm, hhmm]));
const week = z.object({
  mon: ranges.default([]), tue: ranges.default([]), wed: ranges.default([]), thu: ranges.default([]),
  fri: ranges.default([]), sat: ranges.default([]), sun: ranges.default([]),
});
const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/);

export const OfficeConfigSchema = z.object({
  companyName: z.string(),
  assistantName: z.string(),
  openingHours: week,
  transferHours: week.optional(),
  bookingHours: week.optional(),
  minNoticeHours: z.number().int().min(0).max(24 * 14),
  maxDaysAhead: z.number().int().min(1).max(90),
  slotDurationsMin: z.array(z.number().int().min(15).max(120)).min(1),
  slotStepMin: z.number().int().min(5).max(60),
  bufferMin: z.number().int().min(0).max(60).default(0),
  holidays: z.object({
    types: z.array(z.enum(["public", "bank", "optional", "school", "observance"])).default(["public", "bank"]),
    extraClosed: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
    extraOpen: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
  }),
  blockedTransferNumbers: z.array(e164).min(1),
  receptionTeamsWebhookRef: z.string(),
  limits: z.object({
    maxBookingsPerCall: z.number().int().min(0).default(2),
    maxMessagesPerCall: z.number().int().min(0).default(3),
    maxTransfersPerCall: z.number().int().min(0).default(2),
    maxToolCallsPerCall: z.number().int().min(1).default(40),
  }),
  officeAddress: z.string().optional(),
});
export type OfficeConfig = z.infer<typeof OfficeConfigSchema>;
type Week = z.infer<typeof week>;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

let cache: { at: number; value: OfficeConfig } | undefined;

export async function officeConfig(): Promise<OfficeConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const r = await db().query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'office'");
  if (!r.rows[0]) throw new Error("Office settings not seeded");
  const value = OfficeConfigSchema.parse(r.rows[0].value);
  cache = { at: Date.now(), value };
  return value;
}

export function nowLocal(): DateTime {
  return DateTime.now().setZone(TZ);
}

const hd = new Holidays("SE", { timezone: TZ, languages: ["sv"] });

export function holidayName(day: DateTime, cfg: OfficeConfig): string | null {
  const iso = day.setZone(TZ).toISODate()!;
  if (cfg.holidays.extraOpen.includes(iso)) return null;
  if (cfg.holidays.extraClosed.includes(iso)) return "Stängt";
  const hits = hd.isHoliday(day.setZone(TZ).set({ hour: 12 }).toJSDate());
  if (!hits) return null;
  const match = hits.find((h) => (cfg.holidays.types as string[]).includes(h.type));
  return match ? match.name : null;
}

export function dayRanges(day: DateTime, hours: Week, cfg: OfficeConfig): Interval[] {
  const local = day.setZone(TZ).startOf("day");
  if (holidayName(local, cfg)) return [];
  const key = DAYS[local.weekday - 1]!;
  return hours[key].map(([from, to]) => {
    const [fh, fm] = from.split(":").map(Number) as [number, number];
    const [th, tm] = to.split(":").map(Number) as [number, number];
    return Interval.fromDateTimes(local.set({ hour: fh, minute: fm }), local.set({ hour: th, minute: tm }));
  }).filter((i) => i.isValid && !i.isEmpty());
}

export function isWithin(at: DateTime, hours: Week, cfg: OfficeConfig): boolean {
  return dayRanges(at, hours, cfg).some((i) => i.contains(at));
}

export function isOpenNow(cfg: OfficeConfig, at = nowLocal()): boolean {
  return isWithin(at, cfg.openingHours, cfg);
}

export function canTransferNow(cfg: OfficeConfig, at = nowLocal()): boolean {
  return isWithin(at, cfg.transferHours ?? cfg.openingHours, cfg);
}

export function bookingHours(cfg: OfficeConfig): Week {
  return cfg.bookingHours ?? cfg.openingHours;
}

export function fitsBookingHours(start: DateTime, end: DateTime, cfg: OfficeConfig): boolean {
  if (start.setZone(TZ).toISODate() !== end.minus({ milliseconds: 1 }).setZone(TZ).toISODate()) return false;
  return dayRanges(start, bookingHours(cfg), cfg).some((i) => i.start! <= start && i.end! >= end);
}

export function earliestBookable(cfg: OfficeConfig, at = nowLocal()): DateTime {
  const e = at.plus({ hours: cfg.minNoticeHours });
  const step = cfg.slotStepMin;
  const rounded = Math.ceil(e.minute / step) * step;
  return e.set({ second: 0, millisecond: 0 }).startOf("hour").plus({ minutes: rounded });
}

export function describeHours(cfg: OfficeConfig, lang: "sv" | "en"): string {
  const names = lang === "sv"
    ? ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"]
    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return DAYS.map((d, i) => {
    const r = cfg.openingHours[d];
    const txt = r.length ? r.map(([a, b]) => `${a}–${b}`).join(", ") : (lang === "sv" ? "stängt" : "closed");
    return `${names[i]}: ${txt}`;
  }).join("; ");
}
