import type { InvocationContext } from "@azure/functions";

const PHONE_RE = /\+?\d[\d\s\-()]{6,}\d/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SENSITIVE_KEYS = new Set([
  "transcript", "messages", "summary", "summary_sv", "reason", "callername", "caller_name", "company",
  "phone", "phone_e164", "callbacknumber", "callback_number", "email", "number", "customer",
  "password", "token", "secret", "authorization", "cookie", "artifact", "arguments", "content",
]);

export function maskPhone(p: string | null | undefined): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  return `${p.startsWith("+") ? "+" : ""}${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

export function maskText(s: string): string {
  return s.replace(EMAIL_RE, "[email]").replace(PHONE_RE, (m) => maskPhone(m));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") return maskText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface Logger {
  info(msg: string, props?: Record<string, unknown>): void;
  warn(msg: string, props?: Record<string, unknown>): void;
  error(msg: string, props?: Record<string, unknown>): void;
}

function fmt(msg: string, props?: Record<string, unknown>): string {
  return props ? `${maskText(msg)} ${JSON.stringify(redact(props))}` : maskText(msg);
}

export function logger(ctx?: InvocationContext): Logger {
  return {
    info: (m, p) => (ctx ? ctx.log(fmt(m, p)) : console.log(fmt(m, p))),
    warn: (m, p) => (ctx ? ctx.warn(fmt(m, p)) : console.warn(fmt(m, p))),
    error: (m, p) => (ctx ? ctx.error(fmt(m, p)) : console.error(fmt(m, p))),
  };
}

export function errMsg(e: unknown): string {
  return maskText(e instanceof Error ? e.message : String(e)).slice(0, 500);
}
