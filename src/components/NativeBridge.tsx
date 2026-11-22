"use client";

import { useEffect } from "react";
import { healthError, lastHealthSync, saveHealth } from "@/lib/health-store";
import { isNativeApp, onNative, postNative } from "@/lib/native";

/** Re-read Apple Health at most this often (on open and when the app comes back to the front). */
const EVERY_MS = 3 * 3600e3;

/** Mounted once in the layout. Inside the iPhone app it keeps Apple Health data synced. */
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const maybeSync = () => Date.now() - lastHealthSync() > EVERY_MS && postNative({ type: "healthSync", days: 14 });
    const off = onNative(async (m) => {
      if (m.type === "native" && m.health) maybeSync();
      if (m.type === "resumed") maybeSync();
      if (m.type === "healthData" && m.days) {
        try {
          await saveHealth(m.days, m.workouts ?? []);
          window.dispatchEvent(new CustomEvent("nicholasfit-health-saved"));
        } catch (e) {
          window.dispatchEvent(new CustomEvent("nicholasfit-health-saved", { detail: healthError(e) }));
        }
      }
    });
    postNative({ type: "hello" });
    return off;
  }, []);
  return null;
}
