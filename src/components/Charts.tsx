"use client";

import { useState } from "react";

/** Single-series weekly bar chart with an optional goal line. Tap a bar to see its value. */
export function WeeklyBars({
  data,
  goal,
  format,
  label,
}: {
  data: { label: string; value: number }[];
  goal?: number;
  format: (v: number) => string;
  label: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 340, H = 140, top = 18, bottom = 22, left = 4, right = 4;
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const bw = (W - left - right) / data.length;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const active = sel ?? data.length - 1;

  return (
    <div>
      <p className="mb-1 text-sm text-muted">
        {data[active].label}: <span className="font-semibold text-text">{format(data[active].value)}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        <line x1={left} x2={W - right} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {goal != null && (
          <g>
            <line x1={left} x2={W - right} y1={y(goal)} y2={y(goal)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - right} y={y(goal) - 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              goal {goal}
            </text>
          </g>
        )}
        {data.map((d, i) => {
          const h = Math.max(0, H - bottom - y(d.value));
          const x = left + i * bw + 2;
          const w = bw - 4;
          return (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              <rect x={left + i * bw} y={top} width={bw} height={H - top - bottom} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H - bottom} V${H - bottom - h + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, w / 2)},-${Math.min(4, h)} H${x + w - Math.min(4, w / 2)} q${Math.min(4, w / 2)},0 ${Math.min(4, w / 2)},${Math.min(4, h)} V${H - bottom} Z`}
                  fill="var(--accent)"
                  opacity={i === active ? 1 : 0.55}
                />
              )}
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text x={left + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Small single-series line chart of a lift's top set per session. Tap a point to see it. */
export function LiftLine({ points, unit, name }: { points: { date: string; value: number }[]; unit: string; name: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 300, H = 70, pad = 8;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x = (i: number) => (points.length === 1 ? W / 2 : pad + (i / (points.length - 1)) * (W - 2 * pad));
  const y = (v: number) => (hi === lo ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad));
  const active = sel ?? points.length - 1;
  const first = vals[0], last = vals.at(-1)!;
  const change = last - first;
  const date = new Date(points[active].date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{name}</span>
        <span className="text-sm text-muted">
          {points.length > 1 && change !== 0 ? `${change > 0 ? "+" : ""}${Math.round(change * 10) / 10} ${unit} since start` : `${points.length} session${points.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${name} top set per session`}>
        {points.length > 1 && (
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        )}
        {vals.map((v, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
            <circle cx={x(i)} cy={y(v)} r="12" fill="transparent" />
            <circle cx={x(i)} cy={y(v)} r={i === active ? 5 : 3.5} fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted">
        {date}: {vals[active]} {unit}
      </p>
    </div>
  );
}
