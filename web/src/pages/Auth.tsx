import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { ErrorAlert } from "../components/ui";

function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="auth-page">
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="auth-brand">Revisionskonsulterna J Hägglund · {t("app.tagline")}</div>
        <div className="card auth-card">
          <h1>{title}</h1>
          {intro && <p className="muted" style={{ margin: 0 }}>{intro}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

function hashToken(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

export function LoginPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ status: string }>("POST", "/auth/login", { email, password });
      await refresh();
      nav(r.status === "ok" ? "/" : r.status === "mfa_required" ? "/mfa" : "/mfa/enroll", { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(code === "account_locked" ? t("auth.locked") : code === "too_many_attempts" ? t("auth.tooMany") : code === "invalid_credentials" ? t("auth.invalid") : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.loginTitle")} intro={t("auth.loginIntro")}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="email">{t("auth.email")}</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="password">{t("auth.password")}</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={busy}>{t("auth.login")}</button>
        <Link to="/forgot-password">{t("auth.forgot")}</Link>
      </form>
    </AuthShell>
  );
}

export function MfaVerifyPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("POST", "/auth/mfa/verify", { code: code.trim() });
      await refresh();
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.code === "too_many_attempts" ? t("auth.tooMany") : t("auth.invalidCode"));
    }
  }
  return (
    <AuthShell title={t("auth.mfaTitle")} intro={t("auth.mfaIntro")}>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="code">{t("auth.code")}</label><input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <button className="btn btn-primary">{t("auth.verify")}</button>
      </form>
    </AuthShell>
  );
}

export function MfaEnrollPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<{ otpauthUri: string }>("POST", "/auth/mfa/enroll", {})
      .then(async (r) => { setUri(r.otpauthUri); setQr(await QRCode.toDataURL(r.otpauthUri, { margin: 0, width: 180 })); })
      .catch((e) => { if (e instanceof ApiError && e.code === "mfa_already_enabled") nav("/", { replace: true }); else setError(e); });
  }, [nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ recoveryCodes: string[] }>("POST", "/auth/mfa/confirm", { code: code.trim() });
      setCodes(r.recoveryCodes);
    } catch (err) {
      setError(err);
    }
  }

  if (codes) {
    return (
      <AuthShell title={t("auth.recoveryTitle")} intro={t("auth.recoveryIntro")}>
        <div className="codes" style={{ marginTop: 16 }}>{codes.map((c) => <span key={c}>{c}</span>)}</div>
        <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={async () => { await refresh(); nav("/", { replace: true }); }}>{t("auth.recoveryDone")}</button>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("auth.enrollTitle")} intro={t("auth.enrollIntro")}>
      <form onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{t("auth.invalidCode")}</div> : null}
        {qr && <img className="qr" src={qr} alt="QR" style={{ justifySelf: "center" }} />}
        {uri && <details><summary className="muted">{t("auth.manualKey")}</summary><code className="mono" style={{ wordBreak: "break-all" }}>{uri}</code></details>}
        <div className="field"><label htmlFor="code">{t("auth.code")}</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={!uri}>{t("auth.verify")}</button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api("POST", "/auth/password/forgot", { email }).catch(() => undefined);
    setSent(true);
  }
  return (
    <AuthShell title={t("auth.forgotTitle")} intro={t("auth.forgotIntro")}>
      <form onSubmit={submit}>
        {sent ? <div className="alert alert-ok">{t("auth.forgotSent")}</div> : (
          <>
            <div className="field"><label htmlFor="email">{t("auth.email")}</label><input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <button className="btn btn-primary">{t("auth.sendLink")}</button>
          </>
        )}
        <Link to="/login">{t("auth.toLogin")}</Link>
      </form>
    </AuthShell>
  );
}

function NewPasswordForm({ endpoint, title, doneText }: { endpoint: string; title: string; doneText: string }) {
  const { t } = useTranslation();
  const [token] = useState(hashToken);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (window.location.hash) history.replaceState(null, "", window.location.pathname); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMismatch(pw !== pw2);
    if (pw !== pw2) return;
    try {
      await api("POST", endpoint, { token, password: pw });
      setDone(true);
    } catch (err) {
      setError(err);
    }
  }
  const badToken = error instanceof ApiError && error.code === "invalid_or_expired_token";
  return (
    <AuthShell title={title}>
      <form onSubmit={submit}>
        {done ? <div className="alert alert-ok">{doneText}</div> : !token || badToken ? <div className="alert alert-error">{t("auth.badToken")}</div> : (
          <>
            {mismatch && <div className="alert alert-error" role="alert">{t("auth.mismatch")}</div>}
            <ErrorAlert error={error} prefix="auth." />
            <div className="field"><label htmlFor="pw">{t("auth.newPassword")}</label><input id="pw" type="password" autoComplete="new-password" minLength={12} required value={pw} onChange={(e) => setPw(e.target.value)} /><span className="hint">{t("auth.passwordHint")}</span></div>
            <div className="field"><label htmlFor="pw2">{t("auth.repeatPassword")}</label><input id="pw2" type="password" autoComplete="new-password" minLength={12} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <button className="btn btn-primary">{t("common.save")}</button>
          </>
        )}
        <Link to="/login">{t("auth.toLogin")}</Link>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  return <NewPasswordForm endpoint="/auth/password/reset" title={t("auth.resetTitle")} doneText={t("auth.resetDone")} />;
}

export function AcceptInvitePage() {
  const { t } = useTranslation();
  return <NewPasswordForm endpoint="/auth/invite/accept" title={t("auth.inviteTitle")} doneText={t("auth.inviteDone")} />;
}
