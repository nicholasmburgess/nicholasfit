import { hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";
import type { Meal, Measurement, Profile, WeightEntry } from "@/lib/types";

export interface FoodStore {
  listMeals(fromIso: string, toIso: string): Promise<Meal[]>;
  saveMeal(m: Meal): Promise<void>;
  deleteMeal(id: string): Promise<void>;
  listWeights(): Promise<WeightEntry[]>;
  saveWeight(w: WeightEntry): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  listMeasurements(): Promise<Measurement[]>;
  saveMeasurement(m: Measurement): Promise<void>;
  /** Remember today's targets so the home-screen widget can show them. */
  saveTargets(t: { kcal: number; protein: number }): Promise<void>;
}

// ---- Demo mode: this browser only ----
const K = { meals: "nicholasfit.meals.v1", weights: "nicholasfit.weights.v1", profile: "nicholasfit.profile.v1", measurements: "nicholasfit.measurements.v1" };
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

const local: FoodStore = {
  async listMeals(from, to) {
    return read<Meal[]>(K.meals, [])
      .filter((m) => m.eatenAt >= from && m.eatenAt < to)
      .sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
  },
  async saveMeal(m) {
    write(K.meals, [...read<Meal[]>(K.meals, []).filter((x) => x.id !== m.id), m]);
  },
  async deleteMeal(id) {
    write(K.meals, read<Meal[]>(K.meals, []).filter((x) => x.id !== id));
  },
  async listWeights() {
    return read<WeightEntry[]>(K.weights, []).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  },
  async saveWeight(w) {
    write(K.weights, [...read<WeightEntry[]>(K.weights, []).filter((x) => x.id !== w.id), w]);
  },
  async getProfile() {
    return read<Profile | null>(K.profile, null);
  },
  async saveProfile(p) {
    write(K.profile, p);
  },
  async listMeasurements() {
    return read<Measurement[]>(K.measurements, []).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  },
  async saveMeasurement(m) {
    write(K.measurements, [...read<Measurement[]>(K.measurements, []).filter((x) => x.id !== m.id), m]);
  },
  async saveTargets() {},
};

// ---- Supabase ----
type MealRow = {
  id: string; eaten_at: string; description: string; items: Meal["items"];
  kcal: number; protein: number; carbs: number; fat: number; confidence: string | null;
};
const mealFromRow = (r: MealRow): Meal => ({
  id: r.id, eatenAt: r.eaten_at, description: r.description, items: r.items,
  kcal: Number(r.kcal), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat), confidence: r.confidence,
});

const remote: FoodStore = {
  async listMeals(from, to) {
    const { data, error } = await supabase()
      .from("meals")
      .select("id,eaten_at,description,items,kcal,protein,carbs,fat,confidence")
      .gte("eaten_at", from)
      .lt("eaten_at", to)
      .order("eaten_at");
    if (error) throw error;
    return (data as MealRow[]).map(mealFromRow);
  },
  async saveMeal(m) {
    const { error } = await supabase().from("meals").upsert({
      id: m.id, eaten_at: m.eatenAt, description: m.description, items: m.items,
      kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, confidence: m.confidence,
    });
    if (error) throw error;
  },
  async deleteMeal(id) {
    const { error } = await supabase().from("meals").delete().eq("id", id);
    if (error) throw error;
  },
  async listWeights() {
    const { data, error } = await supabase().from("body_weights").select("*").order("measured_at");
    if (error) throw error;
    return (data as { id: string; measured_at: string; kg: number; fat_pct?: number | null; source: WeightEntry["source"] }[]).map((r) => ({
      id: r.id, measuredAt: r.measured_at, kg: Number(r.kg), fatPct: r.fat_pct == null ? null : Number(r.fat_pct), source: r.source,
    }));
  },
  async saveWeight(w) {
    const { error } = await supabase().from("body_weights").upsert({ id: w.id, measured_at: w.measuredAt, kg: w.kg, source: w.source });
    if (error) throw error;
  },
  async getProfile() {
    const { data, error } = await supabase().from("profiles").select("height_cm,sex,birth_year").maybeSingle();
    if (error) throw error;
    return data ? { heightCm: Number(data.height_cm), sex: data.sex, birthYear: data.birth_year } : null;
  },
  async saveProfile(p) {
    const { data } = await supabase().auth.getUser();
    const { error } = await supabase().from("profiles").upsert({
      user_id: data.user?.id, height_cm: p.heightCm, sex: p.sex, birth_year: p.birthYear, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },
  async listMeasurements() {
    const { data, error } = await supabase().from("body_measurements").select("id,measured_at,kind,cm").order("measured_at");
    if (error) throw error;
    return (data as { id: string; measured_at: string; kind: "waist"; cm: number }[]).map((r) => ({ id: r.id, measuredAt: r.measured_at, kind: r.kind, cm: Number(r.cm) }));
  },
  async saveMeasurement(m) {
    const { error } = await supabase().from("body_measurements").upsert({ id: m.id, measured_at: m.measuredAt, kind: m.kind, cm: m.cm });
    if (error) throw error;
  },
  async saveTargets(t) {
    const key = "nicholasfit.targets.cached";
    const value = JSON.stringify({ kcal: Math.round(t.kcal), protein: Math.round(t.protein) });
    try {
      if (localStorage.getItem(key) === value) return;
    } catch {}
    const { data } = await supabase().auth.getUser();
    if (!data.user) return;
    const { error } = await supabase().from("profiles").update({ targets: JSON.parse(value) }).eq("user_id", data.user.id);
    if (error) return; // column may not exist until 0005_widget.sql is run
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

export const foodStore: FoodStore = hasSupabase ? remote : local;

/** Friendlier message when the Phase 2 tables haven't been created yet. */
export function foodError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return "Food tables aren't set up yet. Run supabase/migrations/0002_food.sql in Supabase (see docs/SETUP.md).";
  return msg;
}
