"use client";

import { startOfWeek } from "./format";
import { foodStore } from "./food-store";
import { hasNativeWorkout, postNative } from "./native";
import { dayRange } from "./nutrition";
import { DEFAULT_REMINDERS, type ReminderContext, type ReminderSettings } from "./reminders";
import { store } from "./store";

const KEY = "nicholasfit.reminders.v1";

export function getReminderSettings(): ReminderSettings {
  try {
    return { ...DEFAULT_REMINDERS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ReminderSettings>) };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminderSettings(s: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  sendReminders();
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

/** Work out what's due from today's data and hand it to the iPhone app, which schedules the notifications. */
export async function sendReminders() {
  if (!hasNativeWorkout()) return;
  try {
    const today = dayRange(0);
    const since = new Date(today.start.getTime() - 14 * 86400e3);
    const [workouts, weights, meals, waist] = await Promise.all([
      store.listWorkouts(),
      foodStore.listWeights().catch(() => []),
      foodStore.listMeals(since.toISOString(), today.end.toISOString()).catch(() => []),
      foodStore.listMeasurements().catch(() => []),
    ]);
    const lastStrength = workouts.find((w) => w.finishedAt && (w.templateKey === "A" || w.templateKey === "B"));
    const byDay = new Map<string, number>();
    for (const m of meals) byDay.set(dayKey(m.eatenAt), (byDay.get(dayKey(m.eatenAt)) ?? 0) + m.kcal);
    const todayKey = dayKey(today.start.toISOString());
    const past = [...byDay].filter(([d, k]) => d !== todayKey && k >= 1000).map(([, k]) => k).sort((a, b) => a - b);
    const weekStart = startOfWeek().getTime();
    const context: ReminderContext = {
      lastStrengthAt: lastStrength?.startedAt ?? null,
      weighedToday: weights.some((w) => Date.parse(w.measuredAt) >= today.start.getTime()),
      kcalToday: byDay.get(todayKey) ?? 0,
      typicalKcal: past.length >= 3 ? past[Math.floor(past.length / 2)] : null,
      waistThisWeek: waist.some((m) => m.kind === "waist" && Date.parse(m.measuredAt) >= weekStart),
    };
    postNative({ type: "reminders", settings: getReminderSettings(), context });
  } catch {
    // Offline: the phone keeps the last set.
  }
}
