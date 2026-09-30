import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorAlert, PageHead } from "../components/ui";

type Theme = "system" | "light" | "dark";

export function applyTheme(theme: Theme): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function AccountPage() {
  const { t } = useTranslation();
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pwState, setPwState] = useState<{ ok?: boolean; error?: unknown; mismatch?: boolean }>({});
  const [mfa, setMfa] = useState({ password: "", code: "" });
  const [mfaError, setMfaError] = useState<unknown>(null);
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem("rkjh.theme") as Theme) || "system"; } catch { return "system"; } });

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.repeat) return setPwState({ mismatch: true });
    try {
      await api("POST", "/auth/password/change", { current: pw.current, next: pw.next });
      setPw({ current: "", next: "", repeat: "" });
      setPwState({ ok: true });
    } catch (err) {
      setPwState({ error: err });
    }
  }

  async function disableMfa(e: FormEvent) {
    e.preventDefault();
    try {
      await api("POST", "/auth/mfa/disable", mfa);
      setMfa({ password: "", code: "" });
      await refresh();
    } catch (err) {
      setMfaError(err);
    }
  }

  return (
    <>
      <PageHead title={t("account.title")} intro={me?.user.email} />
      <div className="grid grid-2">
        <div className="card card-pad">
          <h2>{t("account.changePassword")}</h2>
          <form className="list" onSubmit={changePw}>
            {pwState.ok && <div className="alert alert-ok" role="status">{t("account.changed")}</div>}
            {pwState.mismatch && <div className="alert alert-error" role="alert">{t("auth.mismatch")}</div>}
            <ErrorAlert error={pwState.error} prefix="auth." />
            <div className="field"><label htmlFor="cur">{t("account.current")}</label><input id="cur" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div className="field"><label htmlFor="new">{t("auth.newPassword")}</label><input id="new" type="password" autoComplete="new-password" minLength={12} required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><span className="hint">{t("auth.passwordHint")}</span></div>
            <div className="field"><label htmlFor="rep">{t("auth.repeatPassword")}</label><input id="rep" type="password" autoComplete="new-password" minLength={12} required value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} /></div>
            <div><button className="btn btn-primary">{t("common.save")}</button></div>
          </form>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card card-pad">
            <h2>{t("account.mfa")}</h2>
            <p>{me?.mfa.enabled ? <span className="badge badge-good">✓ {t("account.mfaOn")}</span> : <span className="badge">{t("account.mfaOff")}</span>}</p>
            {!me?.mfa.enabled && <button className="btn btn-primary" onClick={() => nav("/mfa/enroll")}>{t("account.enableMfa")}</button>}
            {me?.mfa.enabled && me.user.role === "admin" && <p className="muted">{t("account.mfaAdminRequired")}</p>}
            {me?.mfa.enabled && me.user.role !== "admin" && (
              <form className="list" onSubmit={disableMfa}>
                {mfaError ? <ErrorAlert error={mfaError} /> : null}
                <div className="field"><label htmlFor="mp">{t("auth.password")}</label><input id="mp" type="password" required value={mfa.password} onChange={(e) => setMfa({ ...mfa, password: e.target.value })} /></div>
                <div className="field"><label htmlFor="mc">{t("auth.code")}</label><input id="mc" inputMode="numeric" pattern="\d{6}" required value={mfa.code} onChange={(e) => setMfa({ ...mfa, code: e.target.value })} /></div>
                <div><button className="btn btn-danger">{t("account.disableMfa")}</button></div>
              </form>
            )}
          </div>
          <div className="card card-pad">
            <h2>{t("account.theme")}</h2>
            <select aria-label={t("account.theme")} value={theme} onChange={(e) => {
              const v = e.target.value as Theme;
              setTheme(v);
              applyTheme(v);
              try { localStorage.setItem("rkjh.theme", v); } catch { /* storage unavailable */ }
            }}>
              <option value="system">{t("account.themeSystem")}</option><option value="light">{t("account.themeLight")}</option><option value="dark">{t("account.themeDark")}</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
