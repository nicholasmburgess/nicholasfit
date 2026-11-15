import { supabase } from "@/lib/supabase/client";
import type { Entry, Workout } from "@/lib/types";
import type { Store } from ".";

type Row = {
  id: string;
  name: string;
  template_key: string | null;
  started_at: string;
  finished_at: string | null;
  entries: Entry[];
  notes: string;
};

const fromRow = (r: Row): Workout => ({
  id: r.id,
  name: r.name,
  templateKey: r.template_key,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  entries: r.entries,
  notes: r.notes,
});

const COLS = "id,name,template_key,started_at,finished_at,entries,notes";

export const supabaseStore: Store = {
  async listWorkouts() {
    const { data, error } = await supabase().from("workouts").select(COLS).order("started_at", { ascending: false });
    if (error) throw error;
    return (data as Row[]).map(fromRow);
  },
  async getWorkout(id) {
    const { data, error } = await supabase().from("workouts").select(COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as Row) : null;
  },
  async saveWorkout(w) {
    const { error } = await supabase().from("workouts").upsert({
      id: w.id,
      name: w.name,
      template_key: w.templateKey,
      started_at: w.startedAt,
      finished_at: w.finishedAt,
      entries: w.entries,
      notes: w.notes,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },
  async deleteWorkout(id) {
    const { error } = await supabase().from("workouts").delete().eq("id", id);
    if (error) throw error;
  },
};
