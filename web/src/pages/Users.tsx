import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { dateTime } from "../format";
import { ErrorAlert, Loading, Modal, PageHead } from "../components/ui";

interface User { id: string; email: string; display_name: string; role: "admin" | "staff"; mfa_enabled: boolean; disabled_at: string | null; locked_until: string | null; last_seen_at: string | null }
interface Invite { email: string; display_name: string; role: string; expires_at: string }

function InviteModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({ email: "", displayName: "", role: "staff" });
  const m = useMutation({ mutationFn: () => api("POST", "/admin/invites", f), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["users"] }); onClose(); } });
  const err = m.error instanceof ApiError ? (m.error.code === "user_exists" ? t("users.userExists") : m.error.code === "invalid_input" ? t("users.onlyRkjh") : t("common.error")) : null;
  return (
    <Modal title={t("users.invite")} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn btn-primary" form="inv" disabled={m.isPending}>{t("users.invite")}</button></>}>
      <form id="inv" className="list" onSubmit={(e: FormEvent) => { e.preventDefault(); m.mutate(); }}>
        {err && <div className="alert alert-error" role="alert">{err}</div>}
        <div className="field"><label htmlFor="n">{t("users.name")}</label><input id="n" required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div className="field"><label htmlFor="e">{t("users.email")}</label><input id="e" type="email" required pattern=".+@rkjh\.se" placeholder="namn@rkjh.se" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="r">{t("users.role")}</label><select id="r" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="staff">{t("users.staff")}</option><option value="admin">{t("users.admin")}</option></select></div>
      </form>
    </Modal>
  );
}

export function UsersPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["users"], queryFn: () => api<{ users: User[]; invites: Invite[] }>("GET", "/admin/users") });
  const act = useMutation({
    mutationFn: ({ method, path, body }: { method: string; path: string; body?: unknown }) => api(method, path, body ?? {}),
    onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => setError(e instanceof ApiError && e.code === "last_admin" ? t("users.lastAdmin") : t("common.error")),
  });
  return (
    <>
      <PageHead title={t("users.title")} intro={t("users.intro")} actions={<button className="btn btn-primary" onClick={() => setInviting(true)}>{t("users.invite")}</button>} />
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">{error}</div>}
      <div className="card">
        {q.isLoading ? <Loading /> : q.error ? <div className="card-pad"><ErrorAlert error={q.error} /></div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>{t("users.name")}</th><th>{t("users.role")}</th><th>{t("users.mfa")}</th><th>{t("users.status")}</th><th>{t("users.lastSeen")}</th><th /></tr></thead>
            <tbody>{q.data?.users.map((u) => {
              const self = u.id === me?.user.id;
              const locked = u.locked_until && new Date(u.locked_until) > new Date();
              return (
                <tr key={u.id}>
                  <td><div>{u.display_name}</div><div className="muted">{u.email}</div></td>
                  <td>
                    <select aria-label={t("users.role")} value={u.role} disabled={self || act.isPending} onChange={(e) => act.mutate({ method: "PATCH", path: `/admin/users/${u.id}`, body: { role: e.target.value } })}>
                      <option value="staff">{t("users.staff")}</option><option value="admin">{t("users.admin")}</option>
                    </select>
                  </td>
                  <td>{u.mfa_enabled ? <span className="badge badge-good">✓</span> : <span className="badge">–</span>}</td>
                  <td>{u.disabled_at ? <span className="badge badge-bad">{t("users.disabled")}</span> : locked ? <span className="badge badge-warn">{t("users.locked")}</span> : <span className="badge badge-good">{t("users.active")}</span>}</td>
                  <td className="num">{dateTime(u.last_seen_at)}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {!self && <>
                      <button className="btn btn-sm" onClick={() => act.mutate({ method: "PATCH", path: `/admin/users/${u.id}`, body: { disabled: !u.disabled_at } })}>{u.disabled_at ? t("users.enable") : t("users.disable")}</button>{" "}
                      {u.mfa_enabled && <button className="btn btn-sm" onClick={() => act.mutate({ method: "POST", path: `/admin/users/${u.id}/reset-mfa` })}>{t("users.resetMfa")}</button>}{" "}
                      <button className="btn btn-sm" onClick={() => act.mutate({ method: "POST", path: `/admin/users/${u.id}/revoke-sessions` })}>{t("users.revoke")}</button>
                    </>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      {!!q.data?.invites.length && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-pad" style={{ paddingBottom: 0 }}><h2>{t("users.pending")}</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>{t("users.name")}</th><th>{t("users.role")}</th><th>{t("users.expires")}</th><th /></tr></thead>
            <tbody>{q.data.invites.map((i) => (
              <tr key={i.email}><td><div>{i.display_name}</div><div className="muted">{i.email}</div></td><td>{t(`users.${i.role}`)}</td><td className="num">{dateTime(i.expires_at)}</td>
                <td style={{ textAlign: "right" }}><button className="btn btn-sm btn-danger" onClick={() => act.mutate({ method: "DELETE", path: `/admin/invites/${encodeURIComponent(i.email)}` })}>{t("users.revokeInvite")}</button></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </>
  );
}
