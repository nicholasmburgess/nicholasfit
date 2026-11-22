import { getExercise } from "./exercises";
import type { Entry, SetLog, Workout } from "./types";

/**
 * Estimated one-rep max (Epley: kg × (1 + reps / 30)). Reasonable up to about 12 reps;
 * higher-rep sets are left out because the estimate gets unreliable.
 */
export function e1rm(kg: number | null, reps: number | null): number {
  if (!kg || !reps || reps < 1 || reps > 12) return 0;
  return reps === 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10;
}

const doneSets = (w: Workout, exerciseId: string): SetLog[] =>
  w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.done && s.reps != null));

/** Best heaviest weight and estimated 1RM for an exercise across finished workouts (excluding `exceptId`). */
export function bests(history: Workout[], exerciseId: string, exceptId?: string): { heaviest: number; e1rm: number; sessions: number } {
  const past = history.filter((w) => w.finishedAt && w.id !== exceptId);
  const sets = past.flatMap((w) => doneSets(w, exerciseId));
  return {
    heaviest: Math.max(0, ...sets.map((s) => s.weight ?? 0)),
    e1rm: Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps))),
    sessions: past.filter((w) => doneSets(w, exerciseId).length > 0).length,
  };
}

/**
 * Whether a ticked set beats every earlier session (heavier, or a higher estimated 1RM), and is the
 * best set of this exercise so far today. Used for the live "PR" badge on the workout screen.
 */
export function isLivePr(entry: Entry, si: number, past: { heaviest: number; e1rm: number; sessions: number }): boolean {
  const ex = getExercise(entry.exerciseId);
  const s = entry.sets[si];
  if (!ex || ex.unit !== "reps" || !s?.done || !s.weight || past.sessions === 0) return false;
  const score = e1rm(s.weight, s.reps);
  const beats = s.weight > past.heaviest || score > past.e1rm;
  if (!beats) return false;
  // Only badge the best set of the day so far (the first one, on a tie).
  const scores = entry.sets.map((o) => (o.done ? e1rm(o.weight, o.reps) : -1));
  return scores.indexOf(Math.max(...scores)) === si;
}
