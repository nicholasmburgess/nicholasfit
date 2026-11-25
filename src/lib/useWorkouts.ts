"use client";

import { useCallback, useEffect, useState } from "react";
import { hasNativeWorkout } from "./native";
import { staleFinish } from "./stale";
import { store } from "./store";
import type { Workout } from "./types";

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await store.listWorkouts();
      // Finish workouts left open by mistake, so they count. Inside the iPhone app the phone does this for
      // its own workouts (it may hold newer sets, and it saves them to Apple Health), so the site waits a day.
      const native = hasNativeWorkout();
      const fixed = list
        .map((w) => staleFinish(w))
        .filter((w): w is Workout => !!w && (!native || Date.now() - Date.parse(w.startedAt) > 24 * 3600e3));
      for (const w of fixed) await store.saveWorkout(w).catch(() => {});
      const byId = new Map(fixed.map((w) => [w.id, w]));
      setWorkouts(list.map((w) => byId.get(w.id) ?? w));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workouts");
      setWorkouts([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { workouts, error, reload };
}
