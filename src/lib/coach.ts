import { COACHED, weekKey, type Plan } from "./plan";
import { workoutRows } from "./row";
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

/** Rows in the last 4 weeks (easy and guided), so the coach can weigh cardio fatigue. */
export function coachRows(workouts: Workout[], now = new Date()) {
  const since = new Date(now.getTime() - 28 * 86400e3).toISOString();
  return workouts
    .filter((w) => w.finishedAt && w.startedAt >= since && w.templateKey?.startsWith("ROW"))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((w) => {
      const r = workoutRows(w)[0];
      return { date: w.startedAt.slice(0, 10), session: w.name, minutes: r ? Math.round(r.seconds / 60) : null, metres: r?.distanceM ?? null, avgHr: r?.avgHr ?? null };
    });
}

export function weeksTraining(workouts: Workout[], now = new Date()): number {
  const first = workouts.filter((w) => w.finishedAt).map((w) => w.startedAt).sort()[0];
  return first ? Math.max(1, Math.ceil((now.getTime() - Date.parse(first)) / (7 * 86400e3))) : 0;
}

/** Monday 00:00 of this week: the review looks at the full week before it (Mon–Sun). */
export function reviewWeekEnd(now = new Date()): Date {
  const x = new Date(now);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * A review is due once a week, from Monday, once at least three strength sessions were finished before this
 * week began, so it always reviews a complete Mon–Sun week.
 */
export function reviewDue(plan: Plan, workouts: Workout[], now = new Date()): boolean {
  if (plan.reviewedWeek === weekKey(now)) return false;
  const end = reviewWeekEnd(now).toISOString();
  return workouts.filter((w) => w.finishedAt && w.startedAt < end && w.templateKey && COACHED.includes(w.templateKey)).length >= 3;
}
