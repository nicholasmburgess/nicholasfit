import { getExercise } from "./exercises";
import type { Entry, SetLog, Target, Workout } from "./types";

export type Suggestion = { weight: number | null; reps: number | null; hint: string };

const round = (kg: number, step: number) => Math.max(0, Math.round(kg / step) * step);

/** Most recent finished sessions of this exercise, newest first, with at least one completed set. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): { workout: Workout; sets: SetLog[] }[] {
  return workouts
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((w) =>
      w.entries
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => ({ workout: w, sets: e.sets.filter((s) => s.done && s.reps != null) }))
        .filter((h) => h.sets.length > 0)
        .slice(0, 1),
    );
}

/**
 * Beginner linear progression:
 * - every target set done at the top of the rep range -> add the exercise's increment, reset to the bottom of the range
 * - below the bottom of the range in each of the last two sessions at the same weight -> drop about 10%
 * - otherwise keep the weight and aim for one more rep
 */
export function suggest(workouts: Workout[], exerciseId: string, target: Target): Suggestion {
  const ex = getExercise(exerciseId);
  const history = exerciseHistory(workouts, exerciseId);
  const last = history[0];
  const unit = ex?.unit ?? "reps";

  if (!last) {
    if (unit === "minutes") return { weight: null, reps: target.repMin, hint: `Start with ${target.repMin} minutes at an easy pace` };
    if (unit === "seconds") return { weight: null, reps: target.repMin, hint: `Start with ${target.repMin}-second holds` };
    if (!ex || ex.increment === 0) return { weight: null, reps: target.repMin, hint: "First time: focus on form" };
    return { weight: null, reps: target.repMin, hint: "First time: pick a weight you could lift for 3 or more extra reps" };
  }

  const weight = Math.max(...last.sets.map((s) => s.weight ?? 0));
  const topSets = last.sets.filter((s) => (s.weight ?? 0) === weight);
  const minReps = Math.min(...topSets.map((s) => s.reps ?? 0));
  const hitTop = topSets.length >= target.sets && minReps >= target.repMax;

  if (unit !== "reps" || !ex || ex.increment === 0) {
    if (hitTop) return { weight: weight || null, reps: target.repMax, hint: unit === "reps" ? "Top of range hit: try a harder variation or add reps" : "Top of range hit: hold steady or add 5" };
    return { weight: weight || null, reps: Math.min(target.repMax, minReps + (unit === "seconds" ? 5 : 1)), hint: "Build toward the top of the range" };
  }

  if (hitTop) {
    const next = weight + ex.increment;
    return { weight: next, reps: target.repMin, hint: `Up ${ex.increment} kg: all sets hit ${target.repMax} last time` };
  }

  const prev = history[1];
  if (prev) {
    const prevWeight = Math.max(...prev.sets.map((s) => s.weight ?? 0));
    const prevMin = Math.min(...prev.sets.filter((s) => (s.weight ?? 0) === prevWeight).map((s) => s.reps ?? 0));
    if (prevWeight === weight && minReps < target.repMin && prevMin < target.repMin && weight > 0) {
      const step = ex.load === "barbell" ? 2.5 : 1;
      return { weight: round(weight * 0.9, step), reps: target.repMin, hint: "Stalled twice: dropped about 10% to build back up" };
    }
  }

  return { weight, reps: Math.min(target.repMax, Math.max(target.repMin, minReps + 1)), hint: `Same weight, aim for ${Math.min(target.repMax, Math.max(target.repMin, minReps + 1))} reps or more` };
}

export function buildEntry(workouts: Workout[], exerciseId: string, target: Target): Entry {
  const s = suggest(workouts, exerciseId, target);
  return {
    exerciseId,
    target,
    hint: s.hint,
    goalReps: s.reps ?? undefined,
    sets: Array.from({ length: target.sets }, () => ({ weight: s.weight, reps: null, done: false })),
  };
}

/** Alternate A and B based on the last finished strength session. */
export function nextRoutineKey(workouts: Workout[]): "A" | "B" {
  const last = workouts
    .filter((w) => w.finishedAt && (w.templateKey === "A" || w.templateKey === "B"))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return last?.templateKey === "A" ? "B" : "A";
}

export function volumeKg(w: Workout): number {
  return w.entries.reduce(
    (sum, e) => (getExercise(e.exerciseId)?.unit === "reps" ? sum + e.sets.filter((s) => s.done).reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0) : sum),
    0,
  );
}

export function doneSetCount(w: Workout): number {
  return w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** Short right-hand summary for workout lists, e.g. "15 sets · 2,658 kg" or "20 min row". */
export function workoutSummary(w: Workout): [string, string] {
  const sets = doneSetCount(w);
  const kg = volumeKg(w);
  const minutes = w.entries
    .filter((e) => getExercise(e.exerciseId)?.unit === "minutes")
    .reduce((m, e) => m + e.sets.filter((s) => s.done).reduce((a, s) => a + (s.reps ?? 0), 0), 0);
  const first = `${sets} ${sets === 1 ? "set" : "sets"}`;
  const second = kg > 0 ? `${Math.round(kg).toLocaleString("en-AU")} kg` : minutes > 0 ? `${minutes} min` : "";
  return [first, second];
}
