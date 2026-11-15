import { fitAdjustable } from "./adjustable";
import { buildEntry } from "./progression";
import { getRoutine } from "./routines";
import { newId, store } from "./store";
import type { Workout } from "./types";

export async function startWorkout(history: Workout[], routineKey: string | null): Promise<string> {
  const routine = routineKey ? getRoutine(routineKey) : undefined;
  const w: Workout = {
    id: newId(),
    name: routine?.name ?? "Workout",
    templateKey: routine?.key ?? null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    entries: routine ? fitAdjustable(routine.items.map((i) => buildEntry(history, resolveSwap(history, routine.key, i.exerciseId), i.target, i.exerciseId))) : [],
    notes: "",
  };
  await store.saveWorkout(w);
  return w.id;
}

/** Use the exercise swapped into this routine slot most recently, so a swap sticks for future sessions. */
export function resolveSwap(history: Workout[], routineKey: string, slot: string): string {
  const last = history
    .filter((w) => w.finishedAt && w.templateKey === routineKey)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .find((w) => w.entries.some((e) => (e.slot ?? e.exerciseId) === slot));
  return last?.entries.find((e) => (e.slot ?? e.exerciseId) === slot)?.exerciseId ?? slot;
}
