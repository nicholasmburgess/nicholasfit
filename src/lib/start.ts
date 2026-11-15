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
    entries: routine ? routine.items.map((i) => buildEntry(history, i.exerciseId, i.target)) : [],
    notes: "",
  };
  await store.saveWorkout(w);
  return w.id;
}
