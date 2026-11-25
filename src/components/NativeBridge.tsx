"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { foodStore } from "@/lib/food-store";
import { healthError, lastHealthSync, saveHealth } from "@/lib/health-store";
import { isNativeApp, nativeVersion, onNative, postNative } from "@/lib/native";
import { planStore } from "@/lib/plan-store";
import { sendReminders } from "@/lib/reminders-web";
import { store } from "@/lib/store";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";

/** Fired with the workout when the phone's workout screen hands it back, so an open page shows the latest sets. */
export const WORKOUT_EVENT = "nicholasfit-workout-from-phone";

/** Re-read Apple Health at most this often (on open and when the app comes back to the front). */
const EVERY_MS = 3 * 3600e3;

/** Give the phone's workout screen what it needs to work with no signal: the sign-in, plan and recent history. */
export async function sendSnapshot() {
  if (nativeVersion() < 2) return;
  try {
    const [plan, all, profile] = await Promise.all([planStore.get(), store.listWorkouts(), foodStore.getProfile().catch(() => null)]);
    // Birth year sets the heart-rate zones on the rowing screen.
    postNative({ type: "snapshot", snapshot: { plan, history: all.filter((w) => w.finishedAt).slice(0, 60), birthYear: profile?.birthYear ?? null } });
  } catch {
    // Offline: the phone keeps the last snapshot.
  }
}

async function sendSession() {
  if (nativeVersion() < 2 || !hasSupabase) return;
  const { data } = await supabase().auth.getSession();
  const s = data.session;
  if (!s) return;
  postNative({
    type: "session",
    session: { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at ?? Math.floor(Date.now() / 1000) + 3600 },
  });
}

/** Mounted once in the layout. Inside the iPhone app it keeps Apple Health synced and talks to the workout screen. */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    const maybeSync = () => Date.now() - lastHealthSync() > EVERY_MS && postNative({ type: "healthSync", days: 14 });
    const off = onNative(async (m) => {
      if (m.type === "native" || m.type === "resumed") window.nicholasfitNativeInfo = { expiresAt: m.expiresAt, unsynced: m.unsynced };
      if (m.type === "native") {
        if (m.health) maybeSync();
        sendSession();
        sendSnapshot();
        sendReminders();
      }
      if (m.type === "resumed") {
        maybeSync();
        sendSession();
        sendReminders();
      }
      if (m.type === "healthData" && m.days) {
        try {
          await saveHealth(m.days, m.workouts ?? []);
          window.dispatchEvent(new CustomEvent("nicholasfit-health-saved"));
        } catch (e) {
          window.dispatchEvent(new CustomEvent("nicholasfit-health-saved", { detail: healthError(e) }));
        }
      }
      if (m.type === "workoutClosed") {
        const w = m.workout;
        try {
          if (m.discarded) {
            await store.deleteWorkout(w.id).catch(() => {});
            router.push("/");
          } else {
            await store.saveWorkout(w).catch(() => {});
            window.dispatchEvent(new CustomEvent(WORKOUT_EVENT, { detail: w }));
            router.push(w.finishedAt ? `/workout/${w.id}?done=1` : `/workout/${w.id}`);
          }
        } finally {
          sendSnapshot();
          sendReminders();
        }
      }
    });
    // A refreshed sign-in goes to the phone too, so it can keep syncing on its own.
    const auth = hasSupabase ? supabase().auth.onAuthStateChange((event) => {
          if (event === "TOKEN_REFRESHED") sendSession();
        }) : null;
    postNative({ type: "hello" });
    return () => {
      off();
      auth?.data.subscription.unsubscribe();
    };
  }, [router]);
  return null;
}
