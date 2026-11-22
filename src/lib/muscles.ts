import { getExercise } from "./exercises";
import type { Workout } from "./types";

/**
 * Hard sets per muscle group over the last week. Primary muscle counts 1 set; each secondary muscle
 * counts half, a common way to credit compound lifts. Evidence: about 10+ weekly sets per muscle is
 * linked to more growth than fewer (Schoenfeld, Ogborn & Krieger 2017, J Sports Sci, dose-response
 * meta-analysis); beginners still progress well on less.
 */
export const WEEKLY_SET_TARGET = 10;

const GROUP: Record<string, string> = {
  chest: "Chest",
  lats: "Back",
  "middle back": "Back",
  traps: "Back",
  "lower back": "Lower back",
  shoulders: "Shoulders",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Core",
  adductors: "Quads",
  abductors: "Glutes",
};
export const MAIN_GROUPS = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Core"];

export function weeklyMuscleSets(workouts: Workout[], days = 7, now = new Date()): { group: string; sets: number }[] {
  const since = new Date(now.getTime() - days * 86400e3).toISOString();
  const tally = new Map<string, number>(MAIN_GROUPS.map((g) => [g, 0]));
  for (const w of workouts) {
    if (!w.finishedAt || w.startedAt < since) continue;
    for (const e of w.entries) {
      const ex = getExercise(e.exerciseId);
      if (!ex || ex.unit !== "reps") continue;
      const n = e.sets.filter((s) => s.done).length;
      if (!n) continue;
      const credit = new Map<string, number>();
      for (const m of ex.secondaryMuscles ?? []) if (GROUP[m]) credit.set(GROUP[m], 0.5);
      for (const m of ex.primaryMuscles ?? []) if (GROUP[m]) credit.set(GROUP[m], 1);
      for (const [g, c] of credit) tally.set(g, (tally.get(g) ?? 0) + c * n);
    }
  }
  return [...tally].map(([group, sets]) => ({ group, sets: Math.round(sets * 2) / 2 })).filter((x) => MAIN_GROUPS.includes(x.group) || x.sets > 0);
}
