"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { doneSetCount, volumeKg } from "@/lib/progression";
import { formatMetres, rowLine, workoutRows } from "@/lib/row";
import { personalRecords, volumeChange } from "@/lib/summary";
import { RowReviewCard } from "./RowReviewCard";
import type { Workout } from "@/lib/types";

export function WorkoutSummary({ workout, history }: { workout: Workout; history: Workout[] }) {
  const prs = personalRecords(workout, history);
  const change = volumeChange(workout, history);
  const volume = volumeKg(workout);
  const rows = workoutRows(workout);
  const metres = rows.reduce((m, r) => m + r.distanceM, 0);
  const stats = [
    { label: "Time", value: formatDuration(workout.startedAt, workout.finishedAt) || "—" },
    { label: "Sets", value: String(doneSetCount(workout)) },
    volume > 0 || metres === 0
      ? { label: "Lifted", value: volume > 0 ? `${Math.round(volume).toLocaleString("en-AU")} kg` : "—" }
      : { label: "Rowed", value: formatMetres(metres) },
  ];

  return (
    <section className="rounded-2xl border border-accent/40 bg-card p-4">
      <h2 className="text-xl font-semibold">Well done</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-card-2 py-2">
            <p className="text-lg font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm tabular-nums">
          {rows.map((r) => (
            <li key={r.startedAt}>Row · {rowLine(r)}</li>
          ))}
        </ul>
      )}
      {rows.some((r) => r.session) && (
        <div className="mt-3">
          <RowReviewCard workout={workout} history={history} />
        </div>
      )}
      {change !== null && (
        <p className="mt-3 text-sm">
          {change >= 0 ? `${change}% more` : `${Math.abs(change)}% less`} weight lifted than your last {workout.name}.
        </p>
      )}
      {prs.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {prs.map((p) => (
            <li key={p.exerciseId} className="text-accent">
              ★ {p.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Records will show here once there&apos;s a previous session to beat.</p>
      )}
      <Link href="/flexibility/cooldown" className="mt-4 block rounded-xl border border-accent/40 py-3 text-center text-sm font-semibold text-accent">
        Cool-down stretch · optional
      </Link>
      <Link href="/" className="mt-2 block rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-ink">
        Back to Today
      </Link>
    </section>
  );
}
