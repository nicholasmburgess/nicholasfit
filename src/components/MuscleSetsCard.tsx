"use client";

import { Card } from "@/components/Card";
import { WEEKLY_SET_TARGET, weeklyMuscleSets } from "@/lib/muscles";
import type { Workout } from "@/lib/types";

/** Hard sets per muscle over the last 7 days, against the ~10 sets/week mark linked to more growth. */
export function MuscleSetsCard({ workouts }: { workouts: Workout[] }) {
  const rows = weeklyMuscleSets(workouts);
  const max = Math.max(WEEKLY_SET_TARGET * 1.5, ...rows.map((r) => r.sets));
  const mark = (WEEKLY_SET_TARGET / max) * 100;
  return (
    <Card>
      <h2 className="font-semibold">Sets per muscle · last 7 days</h2>
      <p className="mb-3 text-xs text-muted">Compound lifts count half a set for helper muscles. The line marks {WEEKLY_SET_TARGET} sets, linked to more muscle growth (Schoenfeld et al., 2017).</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.group} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm">
            <span>{r.group}</span>
            <span className="relative h-3 rounded-full bg-card-2">
              <span className={`absolute inset-y-0 left-0 rounded-full ${r.sets >= WEEKLY_SET_TARGET ? "bg-accent" : "bg-accent/50"}`} style={{ width: `${Math.min(100, (r.sets / max) * 100)}%` }} />
              <span className="absolute inset-y-[-3px] w-0.5 bg-text/40" style={{ left: `${mark}%` }} aria-hidden />
            </span>
            <span className="text-right tabular-nums text-muted">{r.sets}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
