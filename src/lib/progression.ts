import { isAdjustable } from "./adjustable";
import { getExercise } from "./exercises";
import { formatMetres, workoutRows } from "./row";
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
 * Beginner double progression:
 * - every target set done at the top of the rep range -> add the exercise's increment, reset to the bottom of the range
 *   (unless the last set was rated Hard, 0-1 reps left, the first time at this weight: then repeat it once)
 * - below the bottom of the range in each of the last two sessions at the same weight -> drop about 10%
 * - otherwise keep the weight and aim for one more rep
 */
/** Conservative first-session weights for an untrained adult (kg; per hand for dumbbells). Cable stacks vary, so these are a rough guide. */
const START_KG: Record<string, number> = {
  Goblet_Squat: 12, Barbell_Squat: 20, "Barbell_Bench_Press_-_Medium_Grip": 20, Dumbbell_Bench_Press: 8, Incline_Dumbbell_Press: 6,
  Seated_Cable_Rows: 20, "One-Arm_Dumbbell_Row": 10, Romanian_Deadlift: 30, Barbell_Deadlift: 40, Barbell_Hip_Thrust: 30,
  Dumbbell_Shoulder_Press: 6, Seated_Barbell_Military_Press: 20, "Barbell_Incline_Bench_Press_-_Medium_Grip": 20, Side_Lateral_Raise: 4, Cable_Seated_Lateral_Raise: 5, Cable_Rear_Delt_Fly: 5, "Wide-Grip_Lat_Pulldown": 25, "Close-Grip_Front_Lat_Pulldown": 25,
  Split_Squat_with_Dumbbells: 6, Face_Pull: 10, "One-Arm_Kettlebell_Swings": 12, "Triceps_Pushdown_-_Rope_Attachment": 10,
  Hammer_Curls: 6, Dumbbell_Bicep_Curl: 6, Pallof_Press: 5, Standing_Biceps_Cable_Curl: 10,
};

/** Days off before the next session repeats the last weight, and before it drops about 10%. */
export const BREAK_DAYS = 10;
export const LONG_BREAK_DAYS = 21;

export function suggest(workouts: Workout[], exerciseId: string, target: Target, now = new Date()): Suggestion {
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
  // Next rep goal: beat the first set at the top weight by one, so one tired last set doesn't lower the goal.
  const repGoal = Math.min(target.repMax, Math.max(target.repMin, minReps + 1, topSets[0]?.reps ?? 0));

  if (unit !== "reps" || !ex || ex.increment === 0) {
    if (hitTop) return { weight: weight || null, reps: target.repMax, hint: unit === "reps" ? "Top of range hit: try a harder variation or add reps" : "Top of range hit: hold steady or add 5" };
    return { weight: weight || null, reps: Math.min(target.repMax, minReps + (unit === "seconds" ? 5 : 1)), hint: "Build toward the top of the range" };
  }

  // Back after a break: no jump on the first session back; after three weeks or more, ease in about 10% lighter.
  const daysOff = (now.getTime() - Date.parse(last.workout.startedAt)) / 86400e3;
  const step = ex.load === "barbell" ? 2.5 : 1;
  if (daysOff >= LONG_BREAK_DAYS && weight > 0)
    return { weight: round(weight * 0.9, step), reps: target.repMin, hint: `${Math.floor(daysOff)} days since last time: about 10% lighter to ease back in` };
  if (daysOff >= BREAK_DAYS)
    return { weight, reps: Math.min(target.repMax, Math.max(target.repMin, minReps)), hint: `${Math.floor(daysOff)} days since last time: same weight and reps to get back into it` };

  // Every set felt easy (4+ reps left): the weight is too light, whatever the reps. Applies to the adjustable
  // dumbbells/kettlebell too: the two-setting limit is within one workout, not between workouts.
  const doneSets = last.sets.filter((s) => s.done);
  const allEasy = doneSets.length >= 2 && doneSets.every((s) => s.feel === "easy");

  if (hitTop || allEasy) {
    // Top of the range but the last set was a grind (0-1 reps left): repeat the weight once so the next
    // jump starts with reps in hand. A second time at the top moves up regardless, so a habit of rating
    // Hard can't stall progress.
    const prev = history[1];
    const prevTop = prev?.sets.filter((s) => (s.weight ?? 0) === weight) ?? [];
    const prevAtTop = prevTop.length >= target.sets && Math.min(...prevTop.map((s) => s.reps ?? 0)) >= target.repMax;
    if (hitTop && topSets.at(-1)?.feel === "hard" && !prevAtTop) {
      return { weight, reps: target.repMax, hint: `Same weight: you hit ${target.repMax} but the last set was a grind. Do it again with a rep or two left, then it goes up` };
    }
    // While still finding a working weight (first few sessions), an easy top-of-range session earns a double step.
    const calibrating = hitTop && history.length <= 3 && topSets.at(-1)?.feel === "easy";
    const up = calibrating ? ex.increment * 2 : ex.increment;
    const each = ex.load === "dumbbell" ? " each" : "";
    return {
      weight: weight + up,
      reps: target.repMin,
      hint: calibrating
        ? `Up ${up} kg${each}: still finding your weight and the last set felt easy`
        : hitTop
          ? `Up ${up} kg${each}: all sets hit ${target.repMax} last time`
          : `Up ${up} kg${each}: every set felt easy last time`,
    };
  }

  // Plateau: three sessions in a row at this weight that started at it (not bumped up mid-workout) where most
  // sets fell short of the range and reps didn't improve on the session before.
  const stalledAt = (i: number) => {
    const h = history[i];
    if (!h) return false;
    const w = Math.max(...h.sets.map((s) => s.weight ?? 0));
    if (w !== weight || (h.sets[0]?.weight ?? 0) !== w) return false;
    const at = h.sets.filter((s) => (s.weight ?? 0) === w);
    const short = at.filter((s) => (s.reps ?? 0) < target.repMin).length;
    if (short * 2 <= at.length) return false;
    const older = history[i + 1];
    const total = (sets: SetLog[]) => sets.filter((s) => (s.weight ?? 0) === w).reduce((a, s) => a + (s.reps ?? 0), 0);
    return !older || total(at) <= total(older.sets);
  };
  if (weight > 0 && stalledAt(0) && stalledAt(1) && stalledAt(2)) {
    return { weight: round(weight * 0.9, step), reps: target.repMin, hint: "Stuck for 3 sessions: dropped about 10% to build back up with good form" };
  }
  if (stalledAt(0) && stalledAt(1)) {
    const reps = target.repMin;
    return { weight, reps, hint: `Same weight, aim for ${reps} reps. If it stalls again, the next session drops about 10%` };
  }

  return { weight, reps: repGoal, hint: `Same weight, aim for ${repGoal} reps or more` };
}

/** The most recent note written for this exercise, so it sticks from session to session. */
export function lastNote(workouts: Workout[], exerciseId: string): string | undefined {
  const w = workouts
    .filter((x) => x.entries.some((e) => e.exerciseId === exerciseId && e.note !== undefined))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const note = w?.entries.find((e) => e.exerciseId === exerciseId && e.note !== undefined)?.note?.trim();
  return note || undefined;
}

export function buildEntry(workouts: Workout[], exerciseId: string, target: Target, slot?: string, now = new Date()): Entry {
  const s = suggest(workouts, exerciseId, target, now);
  const note = lastNote(workouts, exerciseId);
  return {
    exerciseId,
    target,
    hint: s.hint,
    ...(note ? { note } : {}),
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
  const metres = workoutRows(w).reduce((m, r) => m + r.distanceM, 0);
  const first = `${sets} ${sets === 1 ? "set" : "sets"}`;
  const second = kg > 0 ? `${Math.round(kg).toLocaleString("en-AU")} kg` : metres > 0 ? formatMetres(metres) : minutes > 0 ? `${minutes} min` : "";
  return [first, second];
}

/** Log extra reps on a set that was ticked with the suggested number but felt easy. */
export function addReps(entry: Entry, si: number, n: number): Entry {
  return { ...entry, sets: entry.sets.map((s, j) => (j === si ? { ...s, reps: (s.reps ?? 0) + n } : s)) };
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
  // Mid-workout changes are small: a 5 kg jump on a deadlift between sets is too much.
  const inc = ex.load === "barbell" ? Math.min(ex.increment, 2.5) : ex.increment;
  let delta = 0;
  if (feel === "easy") delta = inc;
  else if (reps < entry.target.repMin) delta = -inc;
  if (delta === 0) return { ...entry, sets };
  const from = s.weight;
  const to = Math.max(0, from + delta);
  for (let j = si + 1; j < sets.length; j++) if (!sets[j].done && sets[j].weight === from) sets[j] = { ...sets[j], weight: to };
  const unit = ex.load === "dumbbell" ? " each" : "";
  return { ...entry, sets, hint: delta > 0 ? `Felt easy: next sets up to ${to} kg${unit}` : `Felt hard: next sets down to ${to} kg${unit}` };
}
