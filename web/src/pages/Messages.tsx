import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, qs } from "../api";
import { dateTime, phone } from "../format";
import { ErrorAlert, Loading, PageHead, UrgencyBadge } from "../components/ui";

interface Msg { id: string; call_id: string; staff_name: string | null; caller_name: string; company: string | null; phone_e164: string; reason: string; urgency: string; created_at: string; handled_at: string | null; handled_by_name: string | null }

export function MessagesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "handled">("open");
  const q = useQuery({ queryKey: ["messages", status], queryFn: () => api<{ messages: Msg[] }>("GET", `/messages${qs({ status })}`) });
  const toggle = useMutation({
    mutationFn: (m: Msg) => api("PATCH", `/messages/${m.id}`, { handled: !m.handled_at }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["messages"] }); },
  });
  return (
    <>
      <PageHead title={t("messages.title")} intro={t("messages.intro")} actions={
        <div className="row" role="tablist">
          <button role="tab" aria-selected={status === "open"} className={`btn btn-sm ${status === "open" ? "btn-primary" : ""}`} onClick={() => setStatus("open")}>{t("messages.open")}</button>
          <button role="tab" aria-selected={status === "handled"} className={`btn btn-sm ${status === "handled" ? "btn-primary" : ""}`} onClick={() => setStatus("handled")}>{t("messages.handled")}</button>
        </div>
      } />
      <div className="card">
        {q.isLoading ? <Loading /> : q.error ? <div className="card-pad"><ErrorAlert error={q.error} /></div> : !q.data?.messages.length ? <div className="empty">{t("messages.empty")}</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t("calls.when")}</th><th>{t("calls.caller")}</th><th>{t("calls.reason")}</th><th>{t("calls.staff")}</th><th>{t("calls.urgency")}</th><th /></tr></thead>
            <tbody>{q.data.messages.map((m) => (
              <tr key={m.id}>
                <td className="num" style={{ whiteSpace: "nowrap" }}><Link to={`/calls/${encodeURIComponent(m.call_id)}`}>{dateTime(m.created_at)}</Link></td>
                <td><div>{m.caller_name}</div><div className="muted">{[m.company, phone(m.phone_e164)].filter(Boolean).join(" · ")}</div></td>
                <td style={{ maxWidth: 420 }}>{m.reason}</td>
                <td>{m.staff_name ?? t("messages.toReception")}</td>
                <td><UrgencyBadge urgency={m.urgency} /></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {m.handled_at && <div className="muted" style={{ fontSize: 12 }}>{t("messages.handledBy", { name: m.handled_by_name ?? "–" })}</div>}
                  <button className="btn btn-sm" disabled={toggle.isPending} onClick={() => toggle.mutate(m)}>{m.handled_at ? t("messages.reopen") : t("messages.markHandled")}</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
