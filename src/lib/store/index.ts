import { hasSupabase } from "@/lib/supabase/config";
import type { Workout } from "@/lib/types";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";

export interface Store {
  listWorkouts(): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | null>;
  saveWorkout(w: Workout): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
}

export const store: Store = hasSupabase ? supabaseStore : localStore;

export function newId(): string {
  return crypto.randomUUID();
}
