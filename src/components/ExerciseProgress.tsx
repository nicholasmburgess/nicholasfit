"use client";

import { getExercise, unitLabel } from "@/lib/exercises";
import { formatDate } from "@/lib/format";
import { useWorkouts } from "@/lib/useWorkouts";

/** Top set per session over time, plus the last few sessions. */
export function ExerciseProgress({ exerciseId }: { exerciseId: string }) {
  const { workouts } = useWorkouts();
  const ex = getExercise(exerciseId);
  if (!workouts || !ex) return null;

  const sessions = workouts
    .filter((w) => w.finishedAt)
    .flatMap((w) =>
      w.entries
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({ date: w.startedAt, sets: e.sets.filter((s) => s.done && s.reps != null) })),
    )
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sessions.length === 0)
    return <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">No sessions logged yet. Your progress chart appears here.</p>;

  const usesWeight = ex.unit === "reps" && sessions.some((s) => s.sets.some((x) => (x.weight ?? 0) > 0));
  const value = (s: (typeof sessions)[number]) => Math.max(...s.sets.map((x) => (usesWeight ? (x.weight ?? 0) : (x.reps ?? 0))));
  const vals = sessions.map(value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const W = 320, H = 110, pad = 12;
  const x = (i: number) => (sessions.length === 1 ? W / 2 : pad + (i / (sessions.length - 1)) * (W - 2 * pad));
  const y = (v: number) => (hi === lo ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad));
  const label = usesWeight ? "kg" : unitLabel(ex.unit);

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Your progress</h2>
        <span className="text-sm text-muted">
          Best {hi} {label}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Top set ${label} per session`}>
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2.5" points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--accent)" />
        ))}
      </svg>
      <ul className="mt-2 space-y-1 text-sm">
        {sessions
          .slice(-5)
          .reverse()
          .map((s) => (
            <li key={s.date} className="flex justify-between">
              <span className="text-muted">{formatDate(s.date)}</span>
              <span className="tabular-nums">{s.sets.map((x) => (x.weight ? `${x.weight}×${x.reps}` : `${x.reps}`)).join(", ")}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}
