import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { dateTime, num } from "../format";
import { ErrorAlert, Loading, Modal, PageHead } from "../components/ui";

interface Faq { id: string; question_sv: string; answer_sv: string; question_en: string | null; answer_en: string | null; tags: string[]; active: boolean; updated_at: string; updated_by_name: string | null }
interface KbStatus { state: { mode: "inline" | "search"; corpusTokens: number } | null; runs: { id: string; trigger: string; started_at: string; finished_at: string | null; pages_seen: number; pages_changed: number; error_count: number }[] }
interface KbPage { id: string; url: string; title: string | null; lang: string; tokens: number; status: string; fetched_at: string; changed_at: string; chunks: number }

function FaqEditor({ faq, onClose }: { faq: Faq | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    questionSv: faq?.question_sv ?? "", answerSv: faq?.answer_sv ?? "", questionEn: faq?.question_en ?? "", answerEn: faq?.answer_en ?? "",
    tags: faq?.tags.filter((x) => !x.startsWith("seed:")).join(", ") ?? "", active: faq?.active ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, tags: [...(faq?.tags.filter((x) => x.startsWith("seed:")) ?? []), ...f.tags.split(",").map((s) => s.trim()).filter(Boolean)] };
      return faq ? api("PUT", `/faq/${faq.id}`, body) : api("POST", "/faq", body);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["faq"] }); void qc.invalidateQueries({ queryKey: ["kb-status"] }); onClose(); },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={faq ? t("common.edit") : t("faq.add")} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
      <button className="btn btn-primary" form="faq-form" disabled={save.isPending}>{t("common.save")}</button>
    </>}>
      <form id="faq-form" onSubmit={submit} className="list">
        <ErrorAlert error={save.error} />
        <div className="field"><label htmlFor="qsv">{t("faq.questionSv")}</label><input id="qsv" required minLength={3} maxLength={500} value={f.questionSv} onChange={up("questionSv")} /></div>
        <div className="field"><label htmlFor="asv">{t("faq.answerSv")}</label><textarea id="asv" required maxLength={3000} value={f.answerSv} onChange={up("answerSv")} /><span className="hint">{t("faq.answerHint")}</span></div>
        <div className="field"><label htmlFor="qen">{t("faq.questionEn")}</label><input id="qen" maxLength={500} value={f.questionEn} onChange={up("questionEn")} /></div>
        <div className="field"><label htmlFor="aen">{t("faq.answerEn")}</label><textarea id="aen" maxLength={3000} value={f.answerEn} onChange={up("answerEn")} /></div>
        <div className="field"><label htmlFor="tags">{t("faq.tags")}</label><input id="tags" value={f.tags} onChange={up("tags")} /></div>
        <label className="row"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} style={{ minHeight: 0 }} /> {t("faq.active")}</label>
      </form>
    </Modal>
  );
}

function PageText({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["kb-page", id], queryFn: () => api<{ page: KbPage & { text: string } }>("GET", `/kb/pages/${id}`) });
  return (
    <Modal title={q.data?.page.title ?? q.data?.page.url ?? "…"} onClose={onClose} footer={<button className="btn" onClick={onClose}>{t("common.close")}</button>}>
      {q.isLoading ? <Loading /> : <><p className="muted mono">{q.data?.page.url}</p><div className="transcript">{q.data?.page.text}</div></>}
    </Modal>
  );
}

export function KnowledgePage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"faq" | "pages">("faq");
  const [editing, setEditing] = useState<Faq | null | undefined>(undefined);
  const [viewing, setViewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const faqs = useQuery({ queryKey: ["faq"], queryFn: () => api<{ faqs: Faq[] }>("GET", "/faq") });
  const status = useQuery({ queryKey: ["kb-status"], queryFn: () => api<KbStatus>("GET", "/kb/status") });
  const pages = useQuery({ queryKey: ["kb-pages"], queryFn: () => api<{ pages: KbPage[] }>("GET", "/kb/pages"), enabled: tab === "pages" });
  const del = useMutation({ mutationFn: (id: string) => api("DELETE", `/faq/${id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["faq"] }); } });
  const rescrape = useMutation({
    mutationFn: () => api("POST", "/kb/rescrape", {}),
    onSuccess: () => { setNotice(t("faq.rescrapeQueued")); void qc.invalidateQueries({ queryKey: ["kb-status"] }); },
    onError: (e) => setNotice(e instanceof ApiError && e.code === "scrape_in_progress" ? t("faq.scrapeRunning") : t("common.error")),
  });
  const st = status.data?.state;
  const last = status.data?.runs[0];
  return (
    <>
      <PageHead title={t("faq.title")} intro={t("faq.intro")} actions={<>
        {me?.user.role === "admin" && <button className="btn" onClick={() => rescrape.mutate()} disabled={rescrape.isPending}>{t("faq.rescrape")}</button>}
        <button className="btn btn-primary" onClick={() => setEditing(null)}>{t("faq.add")}</button>
      </>} />
      {notice && <div className="alert alert-info" style={{ marginBottom: 16 }} role="status">{notice}</div>}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row">
          <div><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{t("faq.mode")}</div>
            <div>{st ? (st.mode === "inline" ? t("faq.modeInline") : t("faq.modeSearch")) : "–"}</div>
            {st && <div className="muted" style={{ fontSize: 12 }}>{t("faq.corpus", { tokens: num(st.corpusTokens) })}</div>}</div>
          <div className="spacer" />
          <div style={{ textAlign: "right" }}><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{t("faq.lastRun")}</div>
            <div className="num">{last ? `${dateTime(last.started_at)} · ${last.pages_seen} ${t("faq.pages").toLowerCase()}${last.error_count ? ` · ${last.error_count} ${t("faq.errors").toLowerCase()}` : ""}` : "–"}</div></div>
        </div>
      </div>
      <div className="row" role="tablist" style={{ marginBottom: 12 }}>
        <button role="tab" aria-selected={tab === "faq"} className={`btn btn-sm ${tab === "faq" ? "btn-primary" : ""}`} onClick={() => setTab("faq")}>{t("faq.tabFaq")}</button>
        <button role="tab" aria-selected={tab === "pages"} className={`btn btn-sm ${tab === "pages" ? "btn-primary" : ""}`} onClick={() => setTab("pages")}>{t("faq.tabPages")}</button>
      </div>
      {tab === "faq" ? (
        <div className="card">
          {faqs.isLoading ? <Loading /> : faqs.error ? <div className="card-pad"><ErrorAlert error={faqs.error} /></div> : !faqs.data?.faqs.length ? <div className="empty">{t("faq.empty")}</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>{t("faq.questionSv")}</th><th>{t("faq.answerSv")}</th><th>EN</th><th /></tr></thead>
              <tbody>{faqs.data.faqs.map((f) => (
                <tr key={f.id}>
                  <td style={{ minWidth: 200 }}>{f.question_sv} {!f.active && <span className="badge">{t("faq.inactive")}</span>}</td>
                  <td style={{ maxWidth: 480 }}>{f.answer_sv}</td>
                  <td>{f.answer_en ? "✓" : <span className="muted">–</span>}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn btn-sm" onClick={() => setEditing(f)}>{t("common.edit")}</button>{" "}
                    <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(t("common.confirmDelete"))) del.mutate(f.id); }}>{t("common.delete")}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      ) : (
        <div className="card">
          {pages.isLoading ? <Loading /> : !pages.data?.pages.length ? <div className="empty">–</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>{t("faq.url")}</th><th>{t("faq.status")}</th><th>{t("calls.language")}</th><th style={{ textAlign: "right" }}>{t("faq.tokens")}</th><th>{t("faq.changed")}</th><th>{t("faq.fetched")}</th></tr></thead>
              <tbody>{pages.data.pages.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setViewing(p.id)}>
                  <td><div>{p.title ?? "–"}</div><div className="muted mono" style={{ wordBreak: "break-all" }}>{p.url}</div></td>
                  <td>{p.status === "active" ? <span className="badge badge-good">{t("faq.activePage")}</span> : <span className="badge">{t("faq.gone")}</span>}</td>
                  <td>{t(`lang.${p.lang}`)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{num(p.tokens)}</td>
                  <td className="num">{dateTime(p.changed_at)}</td>
                  <td className="num">{dateTime(p.fetched_at)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
      {editing !== undefined && <FaqEditor faq={editing} onClose={() => setEditing(undefined)} />}
      {viewing && <PageText id={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
