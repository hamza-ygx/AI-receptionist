import { DateTime, Interval } from "luxon";
import { TZ } from "./config.js";
import { bookingHours, dayRanges, earliestBookable, fitsBookingHours, type OfficeConfig } from "./office.js";

export interface Slot { start: DateTime; end: DateTime }

export function candidateSlots(cfg: OfficeConfig, from: DateTime, to: DateTime, durationMin: number, now: DateTime): Slot[] {
  const earliest = DateTime.max(earliestBookable(cfg, now), from.setZone(TZ));
  const latest = DateTime.min(to.setZone(TZ), now.setZone(TZ).plus({ days: cfg.maxDaysAhead }).endOf("day"));
  const slots: Slot[] = [];
  for (let day = earliest.startOf("day"); day <= latest; day = day.plus({ days: 1 })) {
    for (const range of dayRanges(day, bookingHours(cfg), cfg)) {
      let s = range.start!;
      while (s.plus({ minutes: durationMin }) <= range.end!) {
        const e = s.plus({ minutes: durationMin });
        if (s >= earliest && e <= latest) slots.push({ start: s, end: e });
        s = s.plus({ minutes: cfg.slotStepMin });
      }
    }
  }
  return slots;
}

export function isFree(slot: Slot, busy: Interval[], bufferMin: number): boolean {
  const padded = Interval.fromDateTimes(slot.start.minus({ minutes: bufferMin }), slot.end.plus({ minutes: bufferMin }));
  return !busy.some((b) => b.overlaps(padded));
}

export function spread<T extends { start: DateTime }>(slots: T[], max: number): T[] {
  if (slots.length <= max) return slots;
  const byDay = new Map<string, T[]>();
  for (const s of slots) {
    const k = s.start.setZone(TZ).toISODate()!;
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const picked: T[] = [];
  const days = [...byDay.values()];
  for (let round = 0; picked.length < max; round++) {
    let added = false;
    for (const d of days) {
      if (picked.length >= max) break;
      const pickIdx = round === 0 ? 0 : round === 1 ? Math.floor(d.length / 2) : round === 2 ? d.length - 1 : -1;
      const s = pickIdx >= 0 ? d[pickIdx] : undefined;
      if (s && !picked.includes(s)) { picked.push(s); added = true; }
    }
    if (!added) break;
  }
  return picked.sort((a, b) => a.start.toMillis() - b.start.toMillis());
}

export type SlotRuleViolation =
  | "invalid_duration" | "misaligned" | "too_soon" | "too_far" | "outside_hours";

export function validateSlot(cfg: OfficeConfig, start: DateTime, end: DateTime, now: DateTime): SlotRuleViolation | null {
  const minutes = end.diff(start, "minutes").minutes;
  if (!cfg.slotDurationsMin.includes(minutes)) return "invalid_duration";
  const local = start.setZone(TZ);
  if ((local.hour * 60 + local.minute) % cfg.slotStepMin !== 0 || local.second !== 0) return "misaligned";
  if (start < earliestBookable(cfg, now)) return "too_soon";
  if (start > now.plus({ days: cfg.maxDaysAhead }).endOf("day")) return "too_far";
  if (!fitsBookingHours(start, end, cfg)) return "outside_hours";
  return null;
}

export function spokenSlot(start: DateTime, lang: "sv" | "en"): string {
  const s = start.setZone(TZ).setLocale(lang === "sv" ? "sv" : "en-GB");
  return lang === "sv" ? s.toFormat("cccc d LLLL 'kl.' HH:mm") : s.toFormat("cccc d LLLL 'at' HH:mm");
}
