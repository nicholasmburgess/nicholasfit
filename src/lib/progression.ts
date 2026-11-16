import { isAdjustable } from "./adjustable";
import { getExercise } from "./exercises";
import type { Entry, Feel, SetLog, Target, Workout } from "./types";

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
/** Conservative first-session weights for an untrained adult (kg; per hand for dumbbells). Cable stacks vary, so these are a rough guide. */
const START_KG: Record<string, number> = {
  Goblet_Squat: 12, Barbell_Squat: 20, "Barbell_Bench_Press_-_Medium_Grip": 20, Dumbbell_Bench_Press: 8, Incline_Dumbbell_Press: 6,
  Seated_Cable_Rows: 20, "One-Arm_Dumbbell_Row": 10, Romanian_Deadlift: 30, Barbell_Deadlift: 40, Barbell_Hip_Thrust: 30,
  Dumbbell_Shoulder_Press: 6, Seated_Barbell_Military_Press: 20, "Barbell_Incline_Bench_Press_-_Medium_Grip": 20, Side_Lateral_Raise: 4, Cable_Seated_Lateral_Raise: 5, Cable_Rear_Delt_Fly: 5, "Wide-Grip_Lat_Pulldown": 25, "Close-Grip_Front_Lat_Pulldown": 25,
  Split_Squat_with_Dumbbells: 6, Face_Pull: 10, "One-Arm_Kettlebell_Swings": 12, "Triceps_Pushdown_-_Rope_Attachment": 10,
  Hammer_Curls: 6, Dumbbell_Bicep_Curl: 6, Pallof_Press: 5,
};

export function suggest(workouts: Workout[], exerciseId: string, target: Target): Suggestion {
  const ex = getExercise(exerciseId);
  const history = exerciseHistory(workouts, exerciseId);
  const last = history[0];
  const unit = ex?.unit ?? "reps";

  if (!last) {
    if (unit === "minutes") return { weight: null, reps: target.repMin, hint: `Start with ${target.repMin} minutes at an easy pace` };
    if (unit === "seconds") return { weight: null, reps: target.repMin, hint: `Start with ${target.repMin}-second holds` };
    if (!ex || ex.increment === 0) return { weight: null, reps: target.repMin, hint: "First time: focus on form" };
    const start = START_KG[exerciseId];
    if (start != null)
      return { weight: start, reps: target.repMin, hint: `First time: try ${start} kg${ex.load === "dumbbell" ? " each" : ""}. Go heavier on the next set if you could do 4 or more extra reps` };
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
    // While still finding a working weight (first few sessions), an easy last set earns a double step.
    const calibrating = history.length <= 3 && topSets.at(-1)?.feel === "easy" && !isAdjustable(exerciseId);
    const step = calibrating ? ex.increment * 2 : ex.increment;
    return {
      weight: weight + step,
      reps: target.repMin,
      hint: calibrating ? `Up ${step} kg: still finding your weight and the last set felt easy` : `Up ${step} kg: all sets hit ${target.repMax} last time`,
    };
  }

  // Plateau: three sessions in a row at this weight without reaching the bottom of the rep range.
  const stalled = history.slice(0, 3).filter((h) => {
    const w = Math.max(...h.sets.map((s) => s.weight ?? 0));
    const min = Math.min(...h.sets.filter((s) => (s.weight ?? 0) === w).map((s) => s.reps ?? 0));
    return w === weight && min < target.repMin;
  });
  if (stalled.length === 3 && weight > 0) {
    const step = ex.load === "barbell" ? 2.5 : 1;
    return { weight: round(weight * 0.9, step), reps: target.repMin, hint: "Stuck for 3 sessions: dropped about 10% to build back up with good form" };
  }
  if (stalled.length === 2 && stalled[0] === history[0] && stalled[1] === history[1]) {
    const reps = target.repMin;
    return { weight, reps, hint: `Same weight, aim for ${reps} reps. If it stalls again, the next session drops about 10%` };
  }

  return { weight, reps: Math.min(target.repMax, Math.max(target.repMin, minReps + 1)), hint: `Same weight, aim for ${Math.min(target.repMax, Math.max(target.repMin, minReps + 1))} reps or more` };
}

export function buildEntry(workouts: Workout[], exerciseId: string, target: Target, slot?: string): Entry {
  const s = suggest(workouts, exerciseId, target);
  return {
    exerciseId,
    target,
    hint: s.hint,
    goalReps: s.reps ?? undefined,
    ...(slot && slot !== exerciseId ? { slot } : {}),
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

/**
 * After a set is rated, adjust the rest of this exercise: "easy" moves later sets up one step,
 * "hard" with reps short of the range moves them down. The adjustable dumbbell/kettlebell set
 * keeps its weight (re-loading costs a set-up), so it gets a reps tip instead.
 */
export function applyFeel(entry: Entry, si: number, feel: Feel): Entry {
  const sets = entry.sets.map((s, j) => (j === si ? { ...s, feel } : s));
  const ex = getExercise(entry.exerciseId);
  const s = sets[si];
  const remaining = sets.some((x, j) => j > si && !x.done);
  if (!ex || ex.unit !== "reps" || !remaining || feel === "good") return { ...entry, sets };
  const reps = s.reps ?? 0;
  if (s.weight == null || ex.increment === 0 || isAdjustable(entry.exerciseId)) {
    const hint = feel === "easy" ? "Felt easy: aim for 2 more reps on the next set" : reps < entry.target.repMin ? "Felt hard: rest a little longer before the next set" : entry.hint;
    return { ...entry, sets, hint };
  }
  let delta = 0;
  if (feel === "easy") delta = ex.increment;
  else if (reps < entry.target.repMin) delta = -ex.increment;
  if (delta === 0) return { ...entry, sets };
  const from = s.weight;
  const to = Math.max(0, from + delta);
  for (let j = si + 1; j < sets.length; j++) if (!sets[j].done && sets[j].weight === from) sets[j] = { ...sets[j], weight: to };
  const unit = ex.load === "dumbbell" ? " each" : "";
  return { ...entry, sets, hint: delta > 0 ? `Felt easy: next sets up to ${to} kg${unit}` : `Felt hard: next sets down to ${to} kg${unit}` };
}
