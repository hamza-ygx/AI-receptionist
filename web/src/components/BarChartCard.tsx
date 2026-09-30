import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum { key: string; label: string; value: number }

function ChartTooltip({ active, payload, valueLabel, format }: { active?: boolean; payload?: { payload: BarDatum }[]; valueLabel: string; format: (v: number) => string }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return <div className="tooltip"><div className="t">{d.label}</div><div><strong className="num">{format(d.value)}</strong> {valueLabel}</div></div>;
}

export function BarChartCard({ title, data, valueLabel, categoryLabel, layout = "vertical-bars", format = (v) => String(v), height = 240 }: {
  title: string; data: BarDatum[]; valueLabel: string; categoryLabel: string;
  layout?: "vertical-bars" | "horizontal-bars"; format?: (v: number) => string; height?: number;
}) {
  const { t } = useTranslation();
  const [table, setTable] = useState(false);
  const horizontal = layout === "horizontal-bars";
  return (
    <div className="card card-pad">
      <div className="chart-head">
        <h2>{title}</h2>
        <button className="btn-link" onClick={() => setTable((v) => !v)}>{table ? t("common.showChart") : t("common.showTable")}</button>
      </div>
      {table ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{categoryLabel}</th><th style={{ textAlign: "right" }}>{valueLabel}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td className="num" style={{ textAlign: "right" }}>{format(d.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: horizontal ? 32 : 8, bottom: 0, left: horizontal ? 8 : -12 }} barCategoryGap={2}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={horizontal} horizontal={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={12} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} />
                </>
              )}
              <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip valueLabel={valueLabel} format={format} />} />
              <Bar dataKey="value" fill="var(--chart-1)" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 28} isAnimationActive={false}
                label={horizontal ? { position: "right", fill: "var(--text-2)", fontSize: 12, formatter: (v: unknown) => format(Number(v)) } : undefined} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
