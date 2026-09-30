import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api";

export function PageHead({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

const OUTCOME_CLASS: Record<string, string> = {
  booked: "badge-good", transferred: "badge-good", faq_answered: "badge-info", message_taken: "badge-warn", abandoned: "",
};
const OUTCOME_ICON: Record<string, string> = { booked: "📅", transferred: "↪", faq_answered: "✓", message_taken: "✉", abandoned: "–" };

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = useTranslation();
  return <span className={`badge ${OUTCOME_CLASS[outcome] ?? ""}`}><span aria-hidden="true">{OUTCOME_ICON[outcome]}</span>{t(`outcome.${outcome}`)}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: string | null }) {
  const { t } = useTranslation();
  if (!urgency) return <span className="muted">–</span>;
  const cls = urgency === "high" ? "badge-bad" : urgency === "low" ? "" : "badge-info";
  return <span className={`badge ${cls}`}>{urgency === "high" && <span aria-hidden="true">!</span>}{t(`urgency.${urgency}`)}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function ErrorAlert({ error, prefix = "" }: { error: unknown; prefix?: string }) {
  const { t, i18n } = useTranslation();
  if (!error) return null;
  let msg = t("common.error");
  if (error instanceof ApiError) {
    const key = `${prefix}${error.code}`;
    if (prefix && i18n.exists(key)) msg = t(key);
    else if (i18n.exists(`auth.${error.code}`)) msg = t(`auth.${error.code}`);
  }
  return <div className="alert alert-error" role="alert">{msg}</div>;
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="empty" aria-busy="true">{t("common.loading")}</div>;
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="card-pad"><h2 id="modal-title">{title}</h2>{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>{t("common.pageOf", { page, pages, total })}</span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("common.prev")}</button>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("common.next")}</button>
      </div>
    </div>
  );
}
