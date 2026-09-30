import { z } from "zod";
import { db, tx } from "../lib/db.js";
import { optional } from "../lib/config.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";
import { errMsg } from "../lib/log.js";
import { assertPasswordPolicy, hashPassword, needsRehash, PasswordPolicyError, verifyPassword } from "../auth/passwords.js";
import { hashRecovery, newRecoveryCodes, newTotpSecret, verifyTotp } from "../auth/totp.js";
import { clearCookie, createSession, destroySession, destroyUserSessions, mfaRequired, rotateSession, sessionCookie } from "../auth/sessions.js";
import { hit, keyFor } from "../auth/rateLimit.js";
import { escapeHtml, sendEmail } from "../auth/email.js";
import { audit, HttpError, parse, route, type Ctx } from "./http.js";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200)).refine((e) => e.endsWith("@rkjh.se"), "must be an @rkjh.se address");
const passwordSchema = z.string().min(1).max(256);
const MAX_FAILS = 5;

function base(): string {
  return optional("DASHBOARD_BASE_URL", "http://localhost:5173").replace(/\/$/, "");
}

async function policy(pw: string, email: string): Promise<void> {
  try {
    await assertPasswordPolicy(pw, email);
  } catch (e) {
    if (e instanceof PasswordPolicyError) throw new HttpError(e.code === "breach_check_unavailable" ? 503 : 400, `password_${e.code}`);
    throw e;
  }
}

function me(c: Ctx) {
  const s = c.session!;
  return {
    user: { id: s.userId, email: s.email, displayName: s.displayName, role: s.role },
    csrf: s.csrfToken,
    mfa: { enabled: s.mfaEnabled, required: mfaRequired(s), passed: s.mfaPassed || !mfaRequired(s) },
  };
}

route("POST", "/auth/login", "public", async (c) => {
  const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().max(200), password: passwordSchema }), c.body);
  const ipCount = await hit(keyFor("login-ip", c.ip), 15);
  const emailCount = await hit(keyFor("login-email", email), 15);
  if (ipCount > 20 || emailCount > 10) throw new HttpError(429, "too_many_attempts");

  const r = await db().query("SELECT id, email, password_hash, role, mfa_enabled, failed_count, locked_until, lockouts, disabled_at FROM users WHERE email = $1", [email]);
  const u = r.rows[0];
  const ok = await verifyPassword(u?.password_hash ?? null, password);
  const locked = Boolean(u?.locked_until && new Date(u.locked_until) > new Date());
  if (locked) throw new HttpError(ok ? 423 : 401, ok ? "account_locked" : "invalid_credentials");
  if (!u || !ok || u.disabled_at) {
    if (u && !u.disabled_at) {
      const fails = u.failed_count + 1;
      if (fails >= MAX_FAILS) {
        const minutes = Math.min(24 * 60, 15 * 2 ** u.lockouts);
        await db().query("UPDATE users SET failed_count = 0, lockouts = lockouts + 1, locked_until = now() + make_interval(mins => $2) WHERE id = $1", [u.id, minutes]);
        await audit(u.id, "auth.lockout", null, { minutes });
      } else {
        await db().query("UPDATE users SET failed_count = $2 WHERE id = $1", [u.id, fails]);
      }
    }
    throw new HttpError(401, "invalid_credentials");
  }
  await db().query("UPDATE users SET failed_count = 0, lockouts = 0, locked_until = NULL WHERE id = $1", [u.id]);
  if (needsRehash(u.password_hash)) await db().query("UPDATE users SET password_hash = $2 WHERE id = $1", [u.id, await hashPassword(password)]);

  const required = mfaRequired({ role: u.role, mfaEnabled: u.mfa_enabled });
  const { token, csrf } = await createSession(u.id, !required, c.ip, c.userAgent);
  await audit(u.id, "auth.login", null, { mfaPending: required });
  const status = !required ? "ok" : u.mfa_enabled ? "mfa_required" : "mfa_enrollment_required";
  return { body: { status, csrf }, cookies: [sessionCookie(token)] };
});

route("GET", "/auth/me", "pending", async (c) => ({ body: me(c) }));

route("POST", "/auth/logout", "pending", async (c) => {
  await destroySession(c.session!.sessionId);
  return { body: { ok: true }, cookies: [clearCookie()] };
});

route("POST", "/auth/mfa/verify", "pending", async (c) => {
  const { code } = parse(z.object({ code: z.string().trim().min(6).max(24) }), c.body);
  const s = c.session!;
  if (await hit(keyFor("mfa", s.userId), 15) > 10) throw new HttpError(429, "too_many_attempts");
  const u = (await db().query("SELECT totp_secret_enc, totp_last_step, mfa_enabled, recovery_codes_hash FROM users WHERE id = $1", [s.userId])).rows[0];
  if (!u?.mfa_enabled || !u.totp_secret_enc) throw new HttpError(400, "mfa_not_enabled");
  let passed = false;
  if (/^\d{6}$/.test(code)) {
    const step = verifyTotp(u.totp_secret_enc, code, u.totp_last_step === null ? null : Number(u.totp_last_step));
    if (step !== null) {
      await db().query("UPDATE users SET totp_last_step = $2 WHERE id = $1", [s.userId, step]);
      passed = true;
    }
  } else {
    const h = hashRecovery(code);
    const r = await db().query("UPDATE users SET recovery_codes_hash = array_remove(recovery_codes_hash, $2) WHERE id = $1 AND $2 = ANY(recovery_codes_hash) RETURNING id", [s.userId, h]);
    if (r.rowCount) {
      passed = true;
      await audit(s.userId, "auth.recovery_code_used", null);
    }
  }
  if (!passed) throw new HttpError(401, "invalid_code");
  const { token, csrf } = await rotateSession(s.sessionId, true);
  return { body: { ok: true, csrf }, cookies: [sessionCookie(token)] };
});

route("POST", "/auth/mfa/enroll", "pending", async (c) => {
  const s = c.session!;
  if (s.mfaEnabled) throw new HttpError(409, "mfa_already_enabled");
  const { enc, uri } = newTotpSecret(s.email);
  await db().query("UPDATE users SET totp_secret_enc = $2, totp_last_step = NULL WHERE id = $1 AND NOT mfa_enabled", [s.userId, enc]);
  return { body: { otpauthUri: uri } };
});

route("POST", "/auth/mfa/confirm", "pending", async (c) => {
  const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), c.body);
  const s = c.session!;
  if (await hit(keyFor("mfa", s.userId), 15) > 10) throw new HttpError(429, "too_many_attempts");
  const u = (await db().query("SELECT totp_secret_enc, mfa_enabled FROM users WHERE id = $1", [s.userId])).rows[0];
  if (!u?.totp_secret_enc || u.mfa_enabled) throw new HttpError(400, "no_pending_enrollment");
  const step = verifyTotp(u.totp_secret_enc, code, null);
  if (step === null) throw new HttpError(401, "invalid_code");
  const { codes, hashes } = newRecoveryCodes();
  await db().query("UPDATE users SET mfa_enabled = true, totp_last_step = $2, recovery_codes_hash = $3 WHERE id = $1", [s.userId, step, hashes]);
  await audit(s.userId, "auth.mfa_enabled", null);
  const { token, csrf } = await rotateSession(s.sessionId, true);
  return { body: { recoveryCodes: codes, csrf }, cookies: [sessionCookie(token)] };
});

route("POST", "/auth/mfa/disable", "user", async (c) => {
  const { password, code } = parse(z.object({ password: passwordSchema, code: z.string().regex(/^\d{6}$/) }), c.body);
  const s = c.session!;
  if (s.role === "admin") throw new HttpError(403, "mfa_required_for_admins");
  const u = (await db().query("SELECT password_hash, totp_secret_enc, totp_last_step FROM users WHERE id = $1", [s.userId])).rows[0];
  if (!(await verifyPassword(u.password_hash, password))) throw new HttpError(401, "invalid_credentials");
  if (!u.totp_secret_enc || verifyTotp(u.totp_secret_enc, code, u.totp_last_step === null ? null : Number(u.totp_last_step)) === null) throw new HttpError(401, "invalid_code");
  await db().query("UPDATE users SET mfa_enabled = false, totp_secret_enc = NULL, totp_last_step = NULL, recovery_codes_hash = '{}' WHERE id = $1", [s.userId]);
  await audit(s.userId, "auth.mfa_disabled", null);
  return { body: { ok: true } };
});

route("POST", "/auth/password/change", "user", async (c) => {
  const { current, next } = parse(z.object({ current: passwordSchema, next: passwordSchema }), c.body);
  const s = c.session!;
  const u = (await db().query("SELECT password_hash FROM users WHERE id = $1", [s.userId])).rows[0];
  if (!(await verifyPassword(u.password_hash, current))) throw new HttpError(401, "invalid_credentials");
  await policy(next, s.email);
  await db().query("UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1", [s.userId, await hashPassword(next)]);
  await destroyUserSessions(s.userId, s.sessionId);
  await audit(s.userId, "auth.password_changed", null);
  return { body: { ok: true } };
});

route("POST", "/auth/password/forgot", "public", async (c) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().max(200) }), c.body);
  if (await hit(keyFor("forgot-ip", c.ip), 60) > 10 || await hit(keyFor("forgot-email", email), 60) > 3) return { status: 202, body: { ok: true } };
  const u = (await db().query("SELECT id, email, display_name FROM users WHERE email = $1 AND disabled_at IS NULL", [email])).rows[0];
  if (u) {
    const token = randomToken(32);
    await db().query("UPDATE password_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [u.id]);
    await db().query("INSERT INTO password_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 minutes')", [sha256Hex(token), u.id]);
    const link = `${base()}/reset-password#token=${token}`;
    try {
      await sendEmail(u.email, "Återställ ditt lösenord – RKJH Receptionist",
        `Hej ${u.display_name},\n\nÖppna länken för att välja ett nytt lösenord. Länken gäller i 30 minuter och kan bara användas en gång.\n\n${link}\n\nOm du inte begärde detta kan du ignorera mejlet.`,
        `<p>Hej ${escapeHtml(u.display_name)},</p><p>Klicka på länken för att välja ett nytt lösenord. Länken gäller i 30 minuter och kan bara användas en gång.</p><p><a href="${escapeHtml(link)}">Återställ lösenord</a></p><p>Om du inte begärde detta kan du ignorera mejlet.</p>`,
        c.log);
    } catch (e) {
      c.log.error("Password reset email failed", { err: errMsg(e) });
    }
    await audit(u.id, "auth.password_reset_requested", null);
  }
  return { status: 202, body: { ok: true } };
});

route("POST", "/auth/password/reset", "public", async (c) => {
  const { token, password } = parse(z.object({ token: z.string().min(20).max(100), password: passwordSchema }), c.body);
  if (await hit(keyFor("reset-ip", c.ip), 15) > 20) throw new HttpError(429, "too_many_attempts");
  const row = (await db().query(
    `SELECT t.token_hash, u.id, u.email FROM password_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND u.disabled_at IS NULL`,
    [sha256Hex(token)],
  )).rows[0];
  if (!row) throw new HttpError(400, "invalid_or_expired_token");
  await policy(password, row.email);
  const hash = await hashPassword(password);
  await tx(async (t) => {
    const used = await t.query("UPDATE password_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL", [row.token_hash]);
    if (!used.rowCount) throw new HttpError(400, "invalid_or_expired_token");
    await t.query("UPDATE users SET password_hash = $2, password_changed_at = now(), failed_count = 0, locked_until = NULL, lockouts = 0 WHERE id = $1", [row.id, hash]);
    await t.query("DELETE FROM sessions WHERE user_id = $1", [row.id]);
  });
  await audit(row.id, "auth.password_reset", null);
  return { body: { ok: true } };
});

route("POST", "/auth/invite/accept", "public", async (c) => {
  const { token, password } = parse(z.object({ token: z.string().min(20).max(100), password: passwordSchema }), c.body);
  if (await hit(keyFor("invite-ip", c.ip), 15) > 20) throw new HttpError(429, "too_many_attempts");
  const inv = (await db().query("SELECT token_hash, email, display_name, role FROM invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()", [sha256Hex(token)])).rows[0];
  if (!inv) throw new HttpError(400, "invalid_or_expired_token");
  await policy(password, inv.email);
  const hash = await hashPassword(password);
  await tx(async (t) => {
    const used = await t.query("UPDATE invites SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL", [inv.token_hash]);
    if (!used.rowCount) throw new HttpError(400, "invalid_or_expired_token");
    const exists = await t.query("SELECT 1 FROM users WHERE email = $1", [inv.email]);
    if (exists.rowCount) throw new HttpError(409, "user_exists");
    await t.query("INSERT INTO users (email, display_name, password_hash, role) VALUES ($1,$2,$3,$4)", [inv.email, inv.display_name, hash, inv.role]);
  });
  return { body: { ok: true, email: inv.email } };
});

route("GET", "/admin/users", "admin", async () => {
  const r = await db().query(
    `SELECT id, email, display_name, role, mfa_enabled, disabled_at, locked_until, created_at,
            (SELECT max(last_seen_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at
       FROM users u ORDER BY display_name`,
  );
  const invites = await db().query("SELECT email, display_name, role, expires_at, created_at FROM invites WHERE used_at IS NULL AND expires_at > now() ORDER BY created_at DESC");
  return { body: { users: r.rows, invites: invites.rows } };
});

route("POST", "/admin/invites", "admin", async (c) => {
  const b = parse(z.object({ email: emailSchema, displayName: z.string().trim().min(1).max(100), role: z.enum(["admin", "staff"]) }), c.body);
  const exists = await db().query("SELECT 1 FROM users WHERE email = $1", [b.email]);
  if (exists.rowCount) throw new HttpError(409, "user_exists");
  const token = randomToken(32);
  await db().query("UPDATE invites SET expires_at = now() WHERE email = $1 AND used_at IS NULL", [b.email]);
  await db().query(
    "INSERT INTO invites (token_hash, email, display_name, role, invited_by, expires_at) VALUES ($1,$2,$3,$4,$5, now() + interval '72 hours')",
    [sha256Hex(token), b.email, b.displayName, b.role, c.session!.userId],
  );
  const link = `${base()}/accept-invite#token=${token}`;
  await sendEmail(b.email, "Inbjudan till RKJH Receptionist",
    `Hej ${b.displayName},\n\nDu har bjudits in till RKJH:s AI-receptionist. Öppna länken för att välja lösenord (gäller i 72 timmar):\n\n${link}`,
    `<p>Hej ${escapeHtml(b.displayName)},</p><p>Du har bjudits in till RKJH:s AI-receptionist. Klicka på länken för att välja lösenord (gäller i 72 timmar):</p><p><a href="${escapeHtml(link)}">Aktivera konto</a></p>`,
    c.log);
  await audit(c.session!.userId, "admin.invite", b.email, { role: b.role });
  return { status: 201, body: { ok: true } };
});

route("DELETE", "/admin/invites/:email", "admin", async (c) => {
  await db().query("UPDATE invites SET expires_at = now() WHERE email = $1 AND used_at IS NULL", [c.params.email]);
  await audit(c.session!.userId, "admin.invite_revoked", c.params.email!);
  return { body: { ok: true } };
});

async function adminCount(): Promise<number> {
  return Number((await db().query("SELECT count(*) AS n FROM users WHERE role = 'admin' AND disabled_at IS NULL")).rows[0].n);
}

route("PATCH", "/admin/users/:id", "admin", async (c) => {
  const b = parse(z.object({ role: z.enum(["admin", "staff"]).optional(), disabled: z.boolean().optional(), displayName: z.string().trim().min(1).max(100).optional() }), c.body);
  const id = parse(z.uuid(), c.params.id);
  const target = (await db().query("SELECT role, disabled_at FROM users WHERE id = $1", [id])).rows[0];
  if (!target) throw new HttpError(404, "not_found");
  const demotesAdmin = target.role === "admin" && !target.disabled_at && (b.role === "staff" || b.disabled === true);
  if (demotesAdmin && (await adminCount()) <= 1) throw new HttpError(409, "last_admin");
  await db().query(
    `UPDATE users SET role = coalesce($2, role), display_name = coalesce($3, display_name),
       disabled_at = CASE WHEN $4::boolean IS NULL THEN disabled_at WHEN $4 THEN now() ELSE NULL END, updated_at = now()
     WHERE id = $1`,
    [id, b.role ?? null, b.displayName ?? null, b.disabled ?? null],
  );
  if (b.disabled || b.role) await destroyUserSessions(id);
  await audit(c.session!.userId, "admin.user_updated", id, b);
  return { body: { ok: true } };
});

route("POST", "/admin/users/:id/reset-mfa", "admin", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  await db().query("UPDATE users SET mfa_enabled = false, totp_secret_enc = NULL, totp_last_step = NULL, recovery_codes_hash = '{}' WHERE id = $1", [id]);
  await destroyUserSessions(id);
  await audit(c.session!.userId, "admin.mfa_reset", id);
  return { body: { ok: true } };
});

route("POST", "/admin/users/:id/revoke-sessions", "admin", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  await destroyUserSessions(id);
  await audit(c.session!.userId, "admin.sessions_revoked", id);
  return { body: { ok: true } };
});
