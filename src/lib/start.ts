import { buildWorkout } from "./new-workout";
import { DEFAULT_PLAN, type Plan } from "./plan";
import { newId, store } from "./store";
import type { Workout } from "./types";

export { resolveSwap } from "./new-workout";

export async function startWorkout(history: Workout[], routineKey: string | null, plan: Plan = DEFAULT_PLAN): Promise<string> {
  const w = buildWorkout(newId(), history, routineKey, plan);
  await store.saveWorkout(w);
  return w.id;
}
