import { hmacB64, hmacHex, safeEqual } from "../lib/crypto.js";
import { optional, optionalInt, required } from "../lib/config.js";

type Headers = { get(name: string): string | null };

export type AuthResult = { ok: true } | { ok: false; reason: string };

function parseTimestamp(raw: string): number | null {
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n > 1e12 ? n : n * 1000;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

export function verifyVapiRequest(headers: Headers, rawBody: string, now = Date.now()): AuthResult {
  const mode = optional("VAPI_WEBHOOK_AUTH_MODE", "hmac");
  const secret = required("VAPI_WEBHOOK_SECRET");

  if (mode === "bearer") {
    const headerName = optional("VAPI_BEARER_HEADER", "x-vapi-secret");
    let got = headers.get(headerName) ?? "";
    if (headerName.toLowerCase() === "authorization") got = got.replace(/^Bearer\s+/i, "");
    return got && safeEqual(got, secret) ? { ok: true } : { ok: false, reason: "bad_bearer" };
  }

  if (mode !== "hmac") return { ok: false, reason: "bad_mode" };
  const sigHeader = optional("VAPI_HMAC_SIGNATURE_HEADER", "x-signature");
  const tsHeader = optional("VAPI_HMAC_TIMESTAMP_HEADER", "x-timestamp");
  const maxSkewMs = optionalInt("VAPI_HMAC_MAX_SKEW_S", 300) * 1000;

  const sigRaw = headers.get(sigHeader);
  const ts = headers.get(tsHeader);
  if (!sigRaw || !ts) return { ok: false, reason: "missing_signature" };

  const tsMs = parseTimestamp(ts);
  if (tsMs === null || Math.abs(now - tsMs) > maxSkewMs) return { ok: false, reason: "stale_timestamp" };

  const sig = sigRaw.replace(/^(sha256=|v1=|v1,)/i, "").trim();
  const payload = `${ts}.${rawBody}`;
  const candidates = [hmacHex("sha256", secret, payload), hmacB64("sha256", secret, payload)];
  const match = candidates.some((c) => safeEqual(c, sig) || safeEqual(c, sig.toLowerCase()));
  return match ? { ok: true } : { ok: false, reason: "bad_signature" };
}
