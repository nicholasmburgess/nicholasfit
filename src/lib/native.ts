"use client";

import { useEffect, useState } from "react";
import type { Plan } from "@/lib/plan";
import type { Workout } from "@/lib/types";

/**
 * Bridge to the Nicholasfit iPhone app (mobile/), which shows this site in a web view and adds
 * Apple Health and Bluetooth heart rate. In Safari none of this runs.
 */

declare global {
  interface Window {
    NicholasfitNative?: { version: number };
    ReactNativeWebView?: { postMessage(data: string): void };
  }
}

export type HrStatus = "off" | "bluetooth-off" | "searching" | "connected" | "error";
export type HrUpdate = { type: "hr"; status: HrStatus; bpm: number | null; device: string | null; message?: string };

export type HealthDay = { day: string; steps: number | null; activeKcal: number | null; restingHr: number | null; hrvMs: number | null; sleepMin: number | null };
export type HealthWorkout = { id: string; activity: string; startedAt: string; minutes: number; distanceM: number | null; kcal: number | null; source: string | null };

export type FromNative =
  | { type: "native"; version: number; health: boolean; bluetooth: boolean }
  | { type: "resumed" }
  | ({ type: "healthData"; error?: string } & Partial<{ days: HealthDay[]; workouts: HealthWorkout[] }>)
  | HrUpdate
  | { type: "workoutSaved"; id: string; avgHr?: number | null; maxHr?: number | null; error?: string }
  /** The phone's workout screen closed: the site takes the workout back (saves, shows it, or deletes it). */
  | { type: "workoutClosed"; workout: Workout; discarded?: boolean };

export const isNativeApp = () => typeof window !== "undefined" && !!window.NicholasfitNative && !!window.ReactNativeWebView;
/** 2 and up: the iPhone app has its own workout screen. */
export const nativeVersion = () => (isNativeApp() ? (window.NicholasfitNative?.version ?? 0) : 0);
export const hasNativeWorkout = () => nativeVersion() >= 2;

export type ToNative =
  | { type: "hello" }
  | { type: "healthSync"; days?: number }
  | { type: "hrStart" }
  | { type: "hrStop" }
  | { type: "workoutFinished"; id: string; name: string; startedAt: string; finishedAt: string }
  | { type: "session"; session: { url: string; anonKey: string; accessToken: string; refreshToken: string; expiresAt: number } }
  | { type: "snapshot"; snapshot: { plan: Plan; history: Workout[] } }
  | { type: "startWorkout"; key: string | null; snapshot?: { plan: Plan; history: Workout[] } }
  | { type: "openWorkout"; workout: Workout }
  | { type: "shareFile"; name: string; mime: string; text: string };

export function postNative(msg: ToNative) {
  if (isNativeApp()) window.ReactNativeWebView!.postMessage(JSON.stringify(msg));
}

/** Hand an unfinished workout to the iPhone app's workout screen. */
export async function openOnPhone(w: Workout) {
  const { releaseToNative } = await import("@/lib/store/synced");
  await releaseToNative(w.id);
  postNative({ type: "openWorkout", workout: w });
}

export function onNative(fn: (msg: FromNative) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<FromNative>).detail);
  window.addEventListener("nicholasfit-native", handler);
  return () => window.removeEventListener("nicholasfit-native", handler);
}

/** True inside the iPhone app. False during server render and in Safari. */
export function useIsNativeApp() {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}

/** Live heart rate from the strap while `active` is true (only inside the iPhone app). */
export function useHeartRate(active: boolean): HrUpdate | null {
  const [hr, setHr] = useState<HrUpdate | null>(null);
  useEffect(() => {
    if (!active || !isNativeApp()) return;
    const off = onNative((m) => m.type === "hr" && setHr(m));
    postNative({ type: "hrStart" });
    // The strap keeps streaming if you leave this page mid-workout; Finish or Discard turns it off.
    return off;
  }, [active]);
  return active ? hr : null;
}
