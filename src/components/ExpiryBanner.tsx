"use client";

import { useEffect, useState } from "react";
import { onNative } from "@/lib/native";

/** Window copy of the last expiry info from the iPhone app (the message can arrive before this mounts). */
export const NATIVE_INFO_EVENT = "nicholasfit-native-info";
type Info = { expiresAt?: string | null; unsynced?: number };
declare global {
  interface Window {
    nicholasfitNativeInfo?: Info;
  }
}

/** Shown from 2 days before the free-account install stops opening, and whenever workouts are waiting to sync near then. */
export function ExpiryBanner() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    setInfo(window.nicholasfitNativeInfo ?? null);
    const off = onNative((m) => {
      if ((m.type === "native" || m.type === "resumed") && m.expiresAt !== undefined) setInfo({ expiresAt: m.expiresAt, unsynced: m.unsynced });
    });
    return off;
  }, []);
  if (!info?.expiresAt) return null;
  const left = Date.parse(info.expiresAt) - Date.now();
  if (left > 2 * 86400e3) return null;
  const when = new Date(info.expiresAt).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  return (
    <div className="mb-3">
      <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm">
        <p className="font-semibold">{left > 0 ? `The iPhone app expires about ${when}` : "The iPhone app is due to expire"}</p>
        <p className="text-muted">Reinstall it from your Mac (about 2 minutes, your data is kept). Don&apos;t delete the app first.</p>
        {!!info.unsynced && (
          <p className="mt-1 font-medium text-danger">
            {info.unsynced} {info.unsynced === 1 ? "workout hasn't" : "workouts haven't"} synced yet. Open the app with signal before reinstalling.
          </p>
        )}
      </div>
    </div>
  );
}
