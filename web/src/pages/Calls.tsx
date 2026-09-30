import { useState } from "react";
import { useNavigate, useSearchParams, Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, qs } from "../api";
import { dateLong, dateTime, duration, phone, usd } from "../format";
import { ErrorAlert, Loading, OutcomeBadge, PageHead, Pager, UrgencyBadge } from "../components/ui";

interface CallRow {
  id: string; started_at: string; duration_s: number | null; language: string | null; caller_number_e164: string | null;
  caller_name: string | null; company: string | null; reason: string | null; outcome: string; urgency: string | null; staff_name: string | null;
}
interface Staff { id: string; name: string; active: boolean }
const OUTCOMES = ["faq_answered", "booked", "transferred", "message_taken", "abandoned"];

export function CallsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const filters = {
    from: sp.get("from") ?? "", to: sp.get("to") ?? "", outcome: sp.get("outcome") ?? "", staffId: sp.get("staffId") ?? "",
    language: sp.get("language") ?? "", q: sp.get("q") ?? "", page: Number(sp.get("page") ?? "1"),
  };
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== "page") next.delete("page");
    setSp(next, { replace: true });
  };
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api<{ staff: Staff[] }>("GET", "/staff") });
  const calls = useQuery({
    queryKey: ["calls", filters],
    queryFn: () => api<{ total: number; page: number; pageSize: number; calls: CallRow[] }>("GET", `/calls${qs({ ...filters, pageSize: 25 })}`),
    placeholderData: (prev) => prev,
  });

  return (
    <>
      <PageHead title={t("calls.title")} intro={t("calls.intro")} />
      <div className="card">
        <form className="toolbar" onSubmit={(e) => { e.preventDefault(); set("q", q.trim()); }}>
          <div className="field" style={{ flex: "1 1 220px" }}><label htmlFor="q">{t("common.search")}</label><input id="q" type="search" placeholder={t("calls.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="field"><label htmlFor="from">{t("common.from")}</label><input id="from" type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} /></div>
          <div className="field"><label htmlFor="to">{t("common.to")}</label><input id="to" type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} /></div>
          <div className="field"><label htmlFor="outcome">{t("calls.outcome")}</label>
            <select id="outcome" value={filters.outcome} onChange={(e) => set("outcome", e.target.value)}>
              <option value="">{t("common.all")}</option>{OUTCOMES.map((o) => <option key={o} value={o}>{t(`outcome.${o}`)}</option>)}
            </select></div>
          <div className="field"><label htmlFor="staff">{t("calls.staff")}</label>
            <select id="staff" value={filters.staffId} onChange={(e) => set("staffId", e.target.value)}>
              <option value="">{t("common.all")}</option>{staff.data?.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div className="field"><label htmlFor="lang">{t("calls.language")}</label>
            <select id="lang" value={filters.language} onChange={(e) => set("language", e.target.value)}>
              <option value="">{t("common.all")}</option><option value="sv">{t("lang.sv")}</option><option value="en">{t("lang.en")}</option>
            </select></div>
          <button className="btn" type="submit">{t("common.search")}</button>
          {[...sp.keys()].length > 0 && <button className="btn-link" type="button" onClick={() => { setQ(""); setSp(new URLSearchParams(), { replace: true }); }}>{t("common.clear")}</button>}
        </form>
        {calls.isLoading ? <Loading /> : calls.error ? <div className="card-pad"><ErrorAlert error={calls.error} /></div> : !calls.data?.calls.length ? <div className="empty">{t("calls.empty")}</div> : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t("calls.when")}</th><th>{t("calls.caller")}</th><th>{t("calls.reason")}</th><th>{t("calls.outcome")}</th><th>{t("calls.staff")}</th><th>{t("calls.language")}</th><th>{t("calls.duration")}</th></tr></thead>
                <tbody>
                  {calls.data.calls.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => nav(`/calls/${encodeURIComponent(c.id)}`)}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}><Link to={`/calls/${encodeURIComponent(c.id)}`} onClick={(e) => e.stopPropagation()}>{dateTime(c.started_at)}</Link></td>
                      <td><div>{c.caller_name ?? <span className="muted">{t("common.none")}</span>}</div><div className="muted">{[c.company, phone(c.caller_number_e164)].filter((x) => x && x !== "–").join(" · ")}</div></td>
                      <td style={{ maxWidth: 360 }}>{c.reason ?? <span className="muted">–</span>} {c.urgency === "high" && <UrgencyBadge urgency="high" />}</td>
                      <td><OutcomeBadge outcome={c.outcome} /></td>
                      <td>{c.staff_name ?? <span className="muted">–</span>}</td>
                      <td>{c.language ? t(`lang.${c.language}`) : "–"}</td>
                      <td className="num">{duration(c.duration_s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={calls.data.page} pageSize={calls.data.pageSize} total={calls.data.total} onPage={(p) => set("page", String(p))} />
          </>
        )}
      </div>
    </>
  );
}

interface CallDetail {
  call: CallRow & { ended_at: string | null; callback_number: string | null; summary_sv: string | null; transcript: string | null; ended_reason: string | null; cost_total: string | null; vapi_deleted_at: string | null };
  bookings: { id: string; staff_name: string; start_at: string; end_at: string; meeting_type: string; topic: string; teams_join_url: string | null }[];
  messages: { id: string; staff_name: string | null; reason: string; urgency: string; handled_at: string | null }[];
  transfers: { id: string; staff_name: string; status: string; reason: string | null; created_at: string }[];
}

function Transcript({ text }: { text: string }) {
  return (
    <div className="transcript" tabIndex={0}>
      {text.split("\n").map((line, i) => {
        const m = /^([^:]{1,20}):\s?(.*)$/.exec(line);
        return <div key={i}>{m ? <><span className="who">{m[1]}:</span> {m[2]}</> : line}</div>;
      })}
    </div>
  );
}

export function CallDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ["call", id], queryFn: () => api<CallDetail>("GET", `/calls/${encodeURIComponent(id)}`) });
  const erase = async () => {
    if (!confirm(t("calls.eraseConfirm"))) return;
    await api("DELETE", `/calls/${encodeURIComponent(id)}`);
    nav("/calls", { replace: true });
  };
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorAlert error={q.error} />;
  const { call, bookings, messages, transfers } = q.data;
  return (
    <>
      <PageHead title={`${t("calls.detailTitle")} ${dateLong(call.started_at)}`} actions={<>
        {me?.user.role === "admin" && <button className="btn btn-danger" onClick={erase}>{t("calls.erase")}</button>}
        <Link className="btn" to="/calls">{t("common.back")}</Link>
      </>} />
      <div className="grid grid-2">
        <div className="card card-pad">
          <h2>{t("calls.summary")}</h2>
          <p style={{ marginTop: 0 }}>{call.summary_sv ?? <span className="muted">–</span>}</p>
          <div className="row"><OutcomeBadge outcome={call.outcome} /><UrgencyBadge urgency={call.urgency} /></div>
        </div>
        <div className="card card-pad">
          <h2>{t("calls.fields")}</h2>
          <dl className="kv">
            <dt>{t("calls.caller")}</dt><dd>{call.caller_name ?? "–"}</dd>
            <dt>{t("calls.company")}</dt><dd>{call.company ?? "–"}</dd>
            <dt>{t("calls.callerNumber")}</dt><dd className="num">{phone(call.caller_number_e164)}</dd>
            <dt>{t("calls.callbackNumber")}</dt><dd className="num">{phone(call.callback_number)}</dd>
            <dt>{t("calls.reason")}</dt><dd>{call.reason ?? "–"}</dd>
            <dt>{t("calls.staff")}</dt><dd>{call.staff_name ?? "–"}</dd>
            <dt>{t("calls.language")}</dt><dd>{call.language ? t(`lang.${call.language}`) : "–"}</dd>
            <dt>{t("calls.duration")}</dt><dd className="num">{duration(call.duration_s)}</dd>
            <dt>{t("calls.cost")}</dt><dd className="num">{usd(call.cost_total, 3)}</dd>
            <dt>{t("calls.endedReason")}</dt><dd className="mono">{call.ended_reason ?? "–"}</dd>
            <dt>Vapi</dt><dd>{call.vapi_deleted_at ? <span className="badge badge-good">✓ {t("calls.vapiDeleted")}</span> : <span className="badge badge-warn">{t("calls.vapiPending")}</span>}</dd>
          </dl>
        </div>
      </div>
      {(bookings.length > 0 || messages.length > 0 || transfers.length > 0) && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          {bookings.length > 0 && <><h3>{t("calls.bookings")}</h3><ul>{bookings.map((b) => <li key={b.id}>{dateLong(b.start_at)} · {b.staff_name} · {t(`meeting.${b.meeting_type}`)} · {b.topic}</li>)}</ul></>}
          {messages.length > 0 && <><h3>{t("calls.messages")}</h3><ul>{messages.map((m) => <li key={m.id}>{m.staff_name ?? t("messages.toReception")}: {m.reason} <UrgencyBadge urgency={m.urgency} /> {m.handled_at && <span className="badge badge-good">✓ {t("messages.handled")}</span>}</li>)}</ul></>}
          {transfers.length > 0 && <><h3>{t("calls.transfers")}</h3><ul>{transfers.map((x) => <li key={x.id}>{x.staff_name}: {t(`transfer.${x.status}`)}{x.reason ? ` – ${x.reason}` : ""}</li>)}</ul></>}
        </div>
      )}
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h2>{t("calls.transcript")}</h2>
        {call.transcript ? <Transcript text={call.transcript} /> : <p className="muted">{t("calls.noTranscript")}</p>}
      </div>
    </>
  );
}
