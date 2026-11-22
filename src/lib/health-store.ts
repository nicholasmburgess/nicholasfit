import { supabase } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/config";
import type { HealthDay, HealthWorkout } from "@/lib/native";

const LAST_SYNC = "nicholasfit.healthSync.v1";

export function healthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return "Apple Health tables aren't set up yet. Run supabase/migrations/0007_health.sql in Supabase.";
  return msg;
}

export async function saveHealth(days: HealthDay[], workouts: HealthWorkout[]) {
  if (!hasSupabase) return;
  const db = supabase();
  const now = new Date().toISOString();
  const dayRows = days
    .filter((d) => d.steps != null || d.activeKcal != null || d.restingHr != null || d.hrvMs != null || d.sleepMin != null)
    .map((d) => ({
      day: d.day,
      steps: d.steps,
      active_kcal: d.activeKcal,
      resting_hr: d.restingHr,
      hrv_ms: d.hrvMs,
      sleep_min: d.sleepMin,
      updated_at: now,
    }));
  if (dayRows.length) {
    const { error } = await db.from("health_days").upsert(dayRows, { onConflict: "user_id,day" });
    if (error) throw error;
  }
  if (workouts.length) {
    const { error } = await db.from("health_workouts").upsert(
      workouts.map((w) => ({ id: w.id, activity: w.activity, started_at: w.startedAt, minutes: w.minutes, distance_m: w.distanceM, kcal: w.kcal, source: w.source })),
      { onConflict: "user_id,id" },
    );
    if (error) throw error;
  }
  try {
    localStorage.setItem(LAST_SYNC, now);
  } catch {}
}

export function lastHealthSync(): number {
  try {
    return Date.parse(localStorage.getItem(LAST_SYNC) ?? "") || 0;
  } catch {
    return 0;
  }
}

export async function listHealthDays(days = 28): Promise<HealthDay[]> {
  if (!hasSupabase) return [];
  const since = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);
  const { data, error } = await supabase().from("health_days").select("day,steps,active_kcal,resting_hr,hrv_ms,sleep_min").gte("day", since).order("day");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    day: r.day as string,
    steps: r.steps as number | null,
    activeKcal: r.active_kcal as number | null,
    restingHr: r.resting_hr == null ? null : Number(r.resting_hr),
    hrvMs: r.hrv_ms == null ? null : Number(r.hrv_ms),
    sleepMin: r.sleep_min as number | null,
  }));
}

export async function listHealthWorkouts(days = 28): Promise<HealthWorkout[]> {
  if (!hasSupabase) return [];
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data, error } = await supabase().from("health_workouts").select("id,activity,started_at,minutes,distance_m,kcal,source").gte("started_at", since).order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    activity: r.activity as string,
    startedAt: r.started_at as string,
    minutes: Number(r.minutes),
    distanceM: r.distance_m as number | null,
    kcal: r.kcal as number | null,
    source: r.source as string | null,
  }));
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Last 7 days against the 3 weeks before, for the coach and the Progress card. */
export function recoverySummary(days: HealthDay[], now = new Date()) {
  const cut = (n: number) => new Date(now.getTime() - n * 86400e3).toISOString().slice(0, 10);
  const week = days.filter((d) => d.day > cut(7));
  const before = days.filter((d) => d.day <= cut(7) && d.day > cut(28));
  const r = (v: number | null, dp = 0) => (v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp);
  return {
    sleepHours: r(avg(week.map((d) => (d.sleepMin == null ? null : d.sleepMin / 60))), 1),
    sleepHoursBefore: r(avg(before.map((d) => (d.sleepMin == null ? null : d.sleepMin / 60))), 1),
    restingHr: r(avg(week.map((d) => d.restingHr))),
    restingHrBefore: r(avg(before.map((d) => d.restingHr))),
    hrvMs: r(avg(week.map((d) => d.hrvMs))),
    hrvMsBefore: r(avg(before.map((d) => d.hrvMs))),
    steps: r(avg(week.map((d) => d.steps))),
  };
}
export type Recovery = ReturnType<typeof recoverySummary>;
