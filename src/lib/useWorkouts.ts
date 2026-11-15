"use client";

import { useCallback, useEffect, useState } from "react";
import { store } from "./store";
import type { Workout } from "./types";

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setWorkouts(await store.listWorkouts());
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
