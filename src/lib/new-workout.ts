import { fitAdjustable } from "./adjustable";
import { DEFAULT_PLAN, planRoutines, type Plan } from "./plan";
import { buildEntry } from "./progression";
import { withRowPlan } from "./row-sessions";
import type { Workout } from "./types";

/** A new workout for a routine (or an empty one), with weights suggested from history. Pure: shared with the iPhone app. */
export function buildWorkout(id: string, history: Workout[], routineKey: string | null, plan: Plan = DEFAULT_PLAN): Workout {
  const routine = routineKey ? planRoutines(plan).find((r) => r.key === routineKey) : undefined;
  return withRowPlan({
    id,
    name: routine?.name ?? "Workout",
    templateKey: routine?.key ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    entries: routine ? fitAdjustable(routine.items.map((i) => buildEntry(history, resolveSwap(history, routine.key, i.exerciseId), i.target, i.exerciseId))) : [],
    notes: "",
  }, history, plan);
}

/** Use the exercise swapped into this routine slot most recently, so a swap sticks for future sessions. */
export function resolveSwap(history: Workout[], routineKey: string, slot: string): string {
  const last = history
    .filter((w) => w.finishedAt && w.templateKey === routineKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .find((w) => w.entries.some((e) => (e.slot ?? e.exerciseId) === slot));
  return last?.entries.find((e) => (e.slot ?? e.exerciseId) === slot)?.exerciseId ?? slot;
}
