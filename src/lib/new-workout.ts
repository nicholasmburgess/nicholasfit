import { fitAdjustable } from "./adjustable";
import { getExercise } from "./exercises";
import { DEFAULT_PLAN, planRoutines, type Plan } from "./plan";
import { buildEntry, exerciseHistory } from "./progression";
import { withRowPlan } from "./row-sessions";
import type { Target, Workout } from "./types";

/** A new workout for a routine (or an empty one), with weights suggested from history. Pure: shared with the iPhone app. */
export function buildWorkout(id: string, history: Workout[], routineKey: string | null, plan: Plan = DEFAULT_PLAN, now = new Date()): Workout {
  const routine = routineKey ? planRoutines(plan).find((r) => r.key === routineKey) : undefined;
  const used = new Set(routine?.items.map((i) => i.exerciseId) ?? []);
  return withRowPlan({
    id,
    name: routine?.name ?? "Workout",
    templateKey: routine?.key ?? null,
    startedAt: now.toISOString(),
    finishedAt: null,
    entries: routine
      ? fitAdjustable(
          routine.items.map((i) => {
            let exerciseId = resolveSwap(history, routine.key, i.exerciseId);
            let target = i.target;
            let hint: string | undefined;
            const harder = nextCoreStep(history, exerciseId, target);
            if (harder && !used.has(harder.exerciseId)) {
              ({ exerciseId, target, hint } = harder);
            }
            const e = buildEntry(history, exerciseId, target, i.exerciseId, now);
            return { ...e, ...(hint && !exerciseHistory(history, exerciseId).length ? { hint } : {}), ...(i.group ? { group: i.group } : {}) };
          }),
        )
      : [],
    notes: "",
  }, history, plan);
}

/**
 * Use the exercise swapped into this routine slot most recently, so a swap sticks for future sessions.
 * A swap made "just for today" is skipped, so the session after goes back to the earlier choice.
 */
export function resolveSwap(history: Workout[], routineKey: string, slot: string): string {
  const entries = history
    .filter((w) => w.finishedAt && w.templateKey === routineKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((w) => w.entries.filter((e) => (e.slot ?? e.exerciseId) === slot));
  return entries.find((e) => !e.swapToday)?.exerciseId ?? slot;
}

/** Planks held for the full time on every set, two sessions running: move on to a loaded core exercise. */
const CORE_NEXT: Record<string, { exerciseId: string; target: Target }> = {
  Plank: { exerciseId: "Pallof_Press", target: { sets: 3, repMin: 10, repMax: 15, restSec: 60 } },
};

function nextCoreStep(history: Workout[], exerciseId: string, target: Target): { exerciseId: string; target: Target; hint: string } | null {
  const next = CORE_NEXT[exerciseId];
  if (!next || !getExercise(next.exerciseId)) return null;
  const last2 = exerciseHistory(history, exerciseId).slice(0, 2);
  const mastered = last2.length === 2 && last2.every((h) => h.sets.length >= target.sets && h.sets.every((s) => (s.reps ?? 0) >= target.repMax));
  if (!mastered) return null;
  return { ...next, hint: `Planks mastered (${target.sets} × ${target.repMax} s twice): moved on to ${getExercise(next.exerciseId)!.name}` };
}
