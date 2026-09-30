import type { Cookie, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { z } from "zod";
import { logger, errMsg, type Logger } from "../lib/log.js";
import { safeEqual } from "../lib/crypto.js";
import { optional } from "../lib/config.js";
import { db } from "../lib/db.js";
import { COOKIE, loadSession, mfaRequired, type SessionUser } from "../auth/sessions.js";

export class HttpError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
  }
}

export type Access = "public" | "pending" | "user" | "admin";

export interface Ctx {
  req: HttpRequest;
  log: Logger;
  params: Record<string, string>;
  query: URLSearchParams;
  ip: string;
  userAgent: string;
  session: SessionUser | null;
  body: unknown;
}

export interface Reply {
  status?: number;
  body?: unknown;
  cookies?: Cookie[];
}

type Handler = (c: Ctx) => Promise<Reply>;
interface Route { method: string; pattern: RegExp; keys: string[]; access: Access; handler: Handler }

const routes: Route[] = [];

export function route(method: string, path: string, access: Access, handler: Handler): void {
  const keys: string[] = [];
  const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; })}/?$`);
  routes.push({ method, pattern, keys, access, handler });
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "invalid_input", r.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })));
  return r.data;
}

function cookies(req: HttpRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req: HttpRequest): string {
  return req.headers.get("x-azure-clientip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().replace(/:\d+$/, "")
    ?? "unknown";
}

function originAllowed(req: HttpRequest): boolean {
  const allowed = optional("DASHBOARD_BASE_URL", "http://localhost:5173").replace(/\/$/, "");
  const origin = req.headers.get("origin");
  if (origin) return origin === allowed;
  const referer = req.headers.get("referer");
  return referer ? referer.startsWith(`${allowed}/`) : false;
}

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-type": "application/json; charset=utf-8",
};

export async function dispatch(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const log = logger(ctx);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/dash/, "") || "/";
  const method = req.method.toUpperCase();
  const match = routes.map((r) => ({ r, m: r.method === method ? r.pattern.exec(path) : null })).find((x) => x.m);
  if (!match) return { status: 404, headers: SECURITY_HEADERS, jsonBody: { error: "not_found" } };
  const { r, m } = match;

  try {
    const mutating = method !== "GET" && method !== "HEAD";
    if (mutating && !originAllowed(req)) throw new HttpError(403, "bad_origin");

    const session = await loadSession(cookies(req)[COOKIE]);
    if (r.access !== "public") {
      if (!session) throw new HttpError(401, "unauthenticated");
      const fullyAuthed = session.mfaPassed || !mfaRequired(session);
      if (r.access !== "pending" && !fullyAuthed) throw new HttpError(401, "mfa_required");
      if (r.access === "admin" && session.role !== "admin") throw new HttpError(403, "forbidden");
      if (mutating) {
        const token = req.headers.get("x-csrf-token") ?? "";
        if (!token || !safeEqual(token, session.csrfToken)) throw new HttpError(403, "bad_csrf");
      }
    }

    let body: unknown = undefined;
    if (mutating) {
      const raw = await req.text();
      if (raw.length > 64_000) throw new HttpError(413, "too_large");
      if (raw) {
        try { body = JSON.parse(raw); } catch { throw new HttpError(400, "invalid_json"); }
      }
    }

    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m![i + 1]!)]));
    const reply = await r.handler({ req, log, params, query: url.searchParams, ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? "", session, body });
    return {
      status: reply.status ?? 200,
      headers: SECURITY_HEADERS,
      cookies: reply.cookies,
      jsonBody: reply.body ?? { ok: true },
    };
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, headers: SECURITY_HEADERS, jsonBody: { error: e.code, detail: e.detail } };
    }
    log.error("Dashboard API error", { path, err: errMsg(e) });
    return { status: 500, headers: SECURITY_HEADERS, jsonBody: { error: "internal_error" } };
  }
}

export async function audit(userId: string | null, action: string, target: string | null, detail?: Record<string, unknown>): Promise<void> {
  await db().query("INSERT INTO audit_log (user_id, action, target, detail) VALUES ($1,$2,$3,$4)", [userId, action, target, detail ? JSON.stringify(detail) : null]);
}
