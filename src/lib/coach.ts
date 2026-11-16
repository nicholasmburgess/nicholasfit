import { COACHED, weekKey, type Plan } from "./plan";
import type { Workout } from "./types";

/** Compact log of recent strength sessions for the weekly review. */
export function coachSessions(workouts: Workout[], now = new Date()) {
  const since = new Date(now.getTime() - 28 * 86400e3).toISOString();
  return workouts
    .filter((w) => w.finishedAt && w.startedAt >= since && w.templateKey && COACHED.includes(w.templateKey))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((w) => ({
      date: w.startedAt.slice(0, 10),
      routine: w.templateKey,
      exercises: w.entries.map((e) => ({
        id: e.exerciseId,
        target: `${e.target.sets}x${e.target.repMin}-${e.target.repMax}`,
        sets: e.sets
          .filter((s) => s.done)
          .map((s) => `${s.weight != null ? `${s.weight}x` : ""}${s.reps ?? "?"}${s.feel ? ` ${s.feel}` : ""}`),
      })),
    }));
}

export function weeksTraining(workouts: Workout[], now = new Date()): number {
  const first = workouts.filter((w) => w.finishedAt).map((w) => w.startedAt).sort()[0];
  return first ? Math.max(1, Math.ceil((now.getTime() - Date.parse(first)) / (7 * 86400e3))) : 0;
}

/** A review is due once a week, after at least three finished strength sessions. */
export function reviewDue(plan: Plan, workouts: Workout[], now = new Date()): boolean {
  if (plan.reviewedWeek === weekKey(now)) return false;
  return workouts.filter((w) => w.finishedAt && w.templateKey && COACHED.includes(w.templateKey)).length >= 3;
}
