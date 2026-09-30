import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, qs } from "../api";
import { dateTime, dayLabel, duration, monthLabel, num, pct, todayIso, usd } from "../format";
import { BarChartCard } from "../components/BarChartCard";
import { ErrorAlert, Loading, PageHead, Stat } from "../components/ui";

interface Analytics {
  totals: { calls: number; bookings: number; messages: number; transfersAttempted: number; transfersConnected: number; transferSuccessRate: number | null; avgDurationS: number | null; totalCostUsd: number; costPerCallUsd: number | null };
  daily: { day: string; calls: number }[];
  monthly: { month: string; calls: number; cost: number }[];
  outcomes: Record<string, number>;
  hours: number[];
  lastComputed: string | null;
}
const RANGES = [7, 30, 90, 365] as const;
const OUTCOMES = ["faq_answered", "booked", "transferred", "message_taken", "abandoned"];

function fillDays(from: string, to: string, rows: { day: string; calls: number }[]) {
  const map = new Map(rows.map((r) => [r.day, r.calls]));
  const out: { key: string; label: string; value: number }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ key: iso, label: dayLabel(iso), value: map.get(iso) ?? 0 });
  }
  return out;
}

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const to = todayIso();
  const from = todayIso(-(range - 1));
  const q = useQuery({ queryKey: ["analytics", from, to], queryFn: () => api<Analytics>("GET", `/analytics${qs({ from, to })}`) });
  const d = q.data;
  return (
    <>
      <PageHead title={t("analytics.title")} intro={t("analytics.intro")} actions={
        <div className="row" role="group" aria-label="Period">
          {RANGES.map((r) => <button key={r} className={`btn btn-sm ${r === range ? "btn-primary" : ""}`} aria-pressed={r === range} onClick={() => setRange(r)}>{t(`analytics.range${r}`)}</button>)}
        </div>
      } />
      {q.isLoading ? <Loading /> : q.error || !d ? <ErrorAlert error={q.error} /> : (
        <>
          <div className="grid grid-3">
            <Stat label={t("analytics.calls")} value={num(d.totals.calls)} sub={`${num(d.totals.messages)} ${t("analytics.messages").toLowerCase()}`} />
            <Stat label={t("analytics.bookings")} value={num(d.totals.bookings)} />
            <Stat label={t("analytics.transferRate")} value={pct(d.totals.transferSuccessRate)} sub={t("analytics.ofAttempts", { connected: d.totals.transfersConnected, attempts: d.totals.transfersAttempted })} />
            <Stat label={t("analytics.avgDuration")} value={duration(d.totals.avgDurationS)} />
            <Stat label={t("analytics.costPerCall")} value={usd(d.totals.costPerCallUsd, 3)} />
            <Stat label={t("analytics.totalCost")} value={usd(d.totals.totalCostUsd)} />
          </div>
          {d.totals.calls === 0 ? <div className="card empty" style={{ marginTop: 16 }}>{t("analytics.noData")}</div> : (
            <>
              <div style={{ marginTop: 16 }}>
                <BarChartCard title={t("analytics.callsPerDay")} data={fillDays(from, to, d.daily)} valueLabel={t("analytics.calls").toLowerCase()} categoryLabel={t("analytics.day")} />
              </div>
              <div className="grid grid-2" style={{ marginTop: 16 }}>
                <BarChartCard title={t("analytics.outcomes")} layout="horizontal-bars" height={220}
                  data={OUTCOMES.map((o) => ({ key: o, label: t(`outcome.${o}`), value: d.outcomes[o] ?? 0 }))}
                  valueLabel={t("analytics.calls").toLowerCase()} categoryLabel={t("calls.outcome")} />
                <BarChartCard title={t("analytics.peakHours")} height={220}
                  data={d.hours.map((v, h) => ({ key: String(h), label: `${String(h).padStart(2, "0")}`, value: v }))}
                  valueLabel={t("analytics.calls").toLowerCase()} categoryLabel={t("analytics.hour")} />
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-pad" style={{ paddingBottom: 0 }}><h2>{t("analytics.monthly")}</h2></div>
                <div className="table-wrap"><table>
                  <thead><tr><th>{t("analytics.month")}</th><th style={{ textAlign: "right" }}>{t("analytics.calls")}</th><th style={{ textAlign: "right" }}>{t("analytics.totalCost")}</th><th style={{ textAlign: "right" }}>{t("analytics.costPerCall")}</th></tr></thead>
                  <tbody>{d.monthly.map((m) => (
                    <tr key={m.month}><td>{monthLabel(m.month)}</td><td className="num" style={{ textAlign: "right" }}>{num(m.calls)}</td><td className="num" style={{ textAlign: "right" }}>{usd(m.cost)}</td><td className="num" style={{ textAlign: "right" }}>{usd(m.calls ? m.cost / m.calls : null, 3)}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            </>
          )}
          {d.lastComputed && <p className="muted" style={{ fontSize: 12 }}>{t("analytics.updated", { at: dateTime(d.lastComputed) })}</p>}
        </>
      )}
    </>
  );
}
