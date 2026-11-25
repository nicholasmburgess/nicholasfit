"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Fired after new weigh-ins arrive, so pages showing weight or targets reload. */
export const WEIGHTS_EVENT = "nicholasfit-weights-updated";
export const WITHINGS_THROTTLE_KEY = "nicholasfit.withings.lastAutoSync";
const EVERY_MS = 10 * 60e3;

/** Pull new Withings weigh-ins (at most every 10 minutes). Returns how many arrived. */
export async function autoSyncWithings(force = false): Promise<number> {
  try {
    if (!force && Date.now() - Number(localStorage.getItem(WITHINGS_THROTTLE_KEY) ?? 0) < EVERY_MS) return 0;
    localStorage.setItem(WITHINGS_THROTTLE_KEY, String(Date.now()));
  } catch {}
  try {
    const r = (await fetch("/api/withings/sync", { method: "POST" }).then((r) => r.json())) as { added?: number };
    if (r.added) window.dispatchEvent(new CustomEvent(WEIGHTS_EVENT));
    return r.added ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Mounted once in the layout: syncs Withings whenever the app opens or comes back to the front, so food
 * targets and the weekly check-in never run on stale weigh-ins (it used to sync only on the Progress tab).
 */
export function WithingsAutoSync() {
  const path = usePathname();
  useEffect(() => {
    if (path === "/login") return;
    autoSyncWithings();
    const onShow = () => document.visibilityState === "visible" && autoSyncWithings();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [path]);
  return null;
}
