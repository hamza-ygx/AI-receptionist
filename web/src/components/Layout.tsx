import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../auth";
import { setLanguage } from "../i18n";

export function Layout() {
  const { t, i18n } = useTranslation();
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const open = useQuery({ queryKey: ["messages", "open"], queryFn: () => api<{ messages: unknown[] }>("GET", "/messages?status=open"), refetchInterval: 60_000 });
  const openCount = open.data?.messages.length ?? 0;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark" aria-hidden="true">R</div><div>RKJH<small>{t("app.tagline")}</small></div></div>
        <nav className="nav" aria-label="Huvudmeny">
          <NavLink to="/calls">{t("nav.calls")}</NavLink>
          <NavLink to="/messages">{t("nav.messages")}{openCount > 0 && <span className="count" aria-label={`${openCount}`}>{openCount}</span>}</NavLink>
          <NavLink to="/analytics">{t("nav.analytics")}</NavLink>
          <NavLink to="/knowledge">{t("nav.faq")}</NavLink>
          {me?.user.role === "admin" && <NavLink to="/users">{t("nav.users")}</NavLink>}
          <NavLink to="/account">{t("nav.account")}</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div>{me?.user.displayName}</div>
          <button onClick={() => setLanguage(i18n.language === "en" ? "sv" : "en")}>{t("nav.language")}</button>
          <button onClick={async () => { await logout(); nav("/login", { replace: true }); }}>{t("nav.logout")}</button>
        </div>
      </aside>
      <main className="main" id="main"><Outlet /></main>
    </div>
  );
}
