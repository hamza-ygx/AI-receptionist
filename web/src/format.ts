import i18n from "./i18n";

const TZ = "Europe/Stockholm";
const loc = () => (i18n.language === "en" ? "en-GB" : "sv-SE");

export function dateTime(v: string | Date | null | undefined): string {
  if (!v) return "–";
  return new Intl.DateTimeFormat(loc(), { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

export function dateLong(v: string | Date | null | undefined): string {
  if (!v) return "–";
  return new Intl.DateTimeFormat(loc(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
}

export function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat(loc(), { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00Z`));
}

export function monthLabel(ym: string): string {
  return new Intl.DateTimeFormat(loc(), { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));
}

export function duration(s: number | null | undefined): string {
  if (s === null || s === undefined) return "–";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function usd(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "–";
  return new Intl.NumberFormat(loc(), { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(v));
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  return new Intl.NumberFormat(loc(), { style: "percent", maximumFractionDigits: 0 }).format(v);
}

export function num(v: number): string {
  return new Intl.NumberFormat(loc()).format(v);
}

export function phone(e164: string | null | undefined): string {
  if (!e164) return "–";
  if (e164.startsWith("+46")) return `0${e164.slice(3)}`.replace(/^(0\d{2})(\d{3})(\d{2})(\d{2})$/, "$1-$2 $3 $4");
  return e164;
}

export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
