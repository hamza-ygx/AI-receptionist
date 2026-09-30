import { db } from "../lib/db.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";
import { optional } from "../lib/config.js";
import type { Cookie } from "@azure/functions";

export const COOKIE = "__Host-rkjh_sid";
const IDLE_HOURS = 8;
const ABSOLUTE_HOURS = 24;

export interface SessionUser {
  sessionId: string;
  csrfToken: string;
  mfaPassed: boolean;
  userId: string;
  email: string;
  displayName: string;
  role: "admin" | "staff";
  mfaEnabled: boolean;
}

export function ipHash(ip: string): string {
  return sha256Hex(`${optional("RATE_LIMIT_SALT", "rkjh")}|ip|${ip}`).slice(0, 32);
}

export async function createSession(userId: string, mfaPassed: boolean, ip: string, userAgent: string): Promise<{ token: string; csrf: string }> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  await db().query(
    "INSERT INTO sessions (id, user_id, csrf_token, mfa_passed, ip_hash, user_agent) VALUES ($1,$2,$3,$4,$5,$6)",
    [sha256Hex(token), userId, csrf, mfaPassed, ipHash(ip), userAgent.slice(0, 200)],
  );
  return { token, csrf };
}

export async function rotateSession(oldSessionId: string, mfaPassed: boolean): Promise<{ token: string; csrf: string }> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  await db().query(
    "UPDATE sessions SET id = $2, csrf_token = $3, mfa_passed = $4, last_seen_at = now() WHERE id = $1",
    [oldSessionId, sha256Hex(token), csrf, mfaPassed],
  );
  return { token, csrf };
}

export async function loadSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = sha256Hex(token);
  const r = await db().query(
    `SELECT s.id, s.csrf_token, s.mfa_passed, s.last_seen_at, u.id AS user_id, u.email, u.display_name, u.role, u.mfa_enabled
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND u.disabled_at IS NULL
        AND s.last_seen_at > now() - make_interval(hours => $2)
        AND s.created_at > now() - make_interval(hours => $3)`,
    [id, IDLE_HOURS, ABSOLUTE_HOURS],
  );
  const s = r.rows[0];
  if (!s) return null;
  if (Date.now() - new Date(s.last_seen_at).getTime() > 60_000) {
    await db().query("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [id]);
  }
  return {
    sessionId: s.id, csrfToken: s.csrf_token, mfaPassed: s.mfa_passed, userId: s.user_id,
    email: s.email, displayName: s.display_name, role: s.role, mfaEnabled: s.mfa_enabled,
  };
}

export async function destroySession(sessionId: string): Promise<void> {
  await db().query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db().query("DELETE FROM sessions WHERE user_id = $1 AND ($2::text IS NULL OR id <> $2)", [userId, exceptSessionId ?? null]);
}

export function sessionCookie(token: string): Cookie {
  return { name: COOKIE, value: token, path: "/", httpOnly: true, secure: true, sameSite: "Strict" };
}

export function clearCookie(): Cookie {
  return { name: COOKIE, value: "", path: "/", httpOnly: true, secure: true, sameSite: "Strict", maxAge: 0 };
}

export function mfaRequired(u: { role: string; mfaEnabled: boolean }): boolean {
  return u.role === "admin" || u.mfaEnabled;
}
