import { getExercise } from "./exercises";
import { startOfWeek } from "./format";
import { volumeKg } from "./progression";
import { personalRecords } from "./summary";
import type { Workout } from "./types";

export const WEEKLY_GOAL = 3;

export type Week = { start: Date; label: string; sessions: number; volume: number };

/** Last `n` weeks (Monday to Sunday), oldest first. */
export function weeklyTotals(workouts: Workout[], n = 12): Week[] {
  const thisWeek = startOfWeek();
  const weeks: Week[] = Array.from({ length: n }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * (n - 1 - i));
    return { start, label: start.toLocaleDateString("en-AU", { day: "numeric", month: "short" }), sessions: 0, volume: 0 };
  });
  for (const w of workouts) {
    if (!w.finishedAt) continue;
    const t = Date.parse(w.startedAt);
    const idx = weeks.findIndex((wk, i) => t >= wk.start.getTime() && (i === n - 1 || t < weeks[i + 1].start.getTime()));
    if (idx < 0) continue;
    weeks[idx].sessions += 1;
    weeks[idx].volume += volumeKg(w);
  }
  return weeks;
}

/** Consecutive weeks hitting the session goal, counting this week only once it's reached. */
export function weekStreak(workouts: Workout[]): number {
  const weeks = weeklyTotals(workouts, 104);
  let i = weeks.length - 1;
  if (weeks[i].sessions < WEEKLY_GOAL) i -= 1;
  let streak = 0;
  for (; i >= 0 && weeks[i].sessions >= WEEKLY_GOAL; i--) streak += 1;
  return streak;
}

export function totals(workouts: Workout[]) {
  const done = workouts.filter((w) => w.finishedAt);
  return {
    workouts: done.length,
    volume: done.reduce((s, w) => s + volumeKg(w), 0),
    minutes: done.reduce((s, w) => s + Math.max(0, (Date.parse(w.finishedAt!) - Date.parse(w.startedAt)) / 60000), 0),
  };
}

export type LiftSeries = { exerciseId: string; name: string; points: { date: string; value: number }[]; unit: string };

/** Top set per session for the most-trained exercises. */
export function liftSeries(workouts: Workout[], limit = 6): LiftSeries[] {
  const map = new Map<string, { date: string; value: number }[]>();
  for (const w of [...workouts].filter((w) => w.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const e of w.entries) {
      const ex = getExercise(e.exerciseId);
      if (!ex || ex.pattern === "Cardio") continue;
      const done = e.sets.filter((s) => s.done && s.reps != null);
      if (!done.length) continue;
      const weighted = ex.unit === "reps" && done.some((s) => (s.weight ?? 0) > 0);
      const value = Math.max(...done.map((s) => (weighted ? (s.weight ?? 0) : (s.reps ?? 0))));
      map.set(e.exerciseId, [...(map.get(e.exerciseId) ?? []), { date: w.startedAt, value }]);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([id, points]) => {
      const ex = getExercise(id)!;
      const weighted = ex.unit === "reps" && points.some((p) => p.value > 0) && ex.load !== "bodyweight";
      return { exerciseId: id, name: ex.name, points, unit: weighted ? "kg" : ex.unit === "seconds" ? "sec" : "reps" };
    });
}

export function recentRecords(workouts: Workout[], limit = 6) {
  const done = workouts.filter((w) => w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const out: { date: string; text: string }[] = [];
  for (const w of done) {
    for (const r of personalRecords(w, workouts)) out.push({ date: w.startedAt, text: r.text });
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
