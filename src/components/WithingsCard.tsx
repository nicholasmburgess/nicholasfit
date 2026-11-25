"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { WEIGHTS_EVENT, WITHINGS_THROTTLE_KEY as THROTTLE_KEY } from "@/components/WithingsAutoSync";

type Status = { available: boolean; connected?: boolean; lastSync?: string | null; error?: string; added?: number };

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** Connect button, or a quiet status line that syncs new weigh-ins (at most every 10 minutes). */
export function WithingsCard({ onSynced }: { onSynced?: () => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [flash] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("withings")));

  async function sync() {
    setSyncing(true);
    try {
      const r: Status = await fetch("/api/withings/sync", { method: "POST" }).then((r) => r.json());
      setS(r);
      try {
        localStorage.setItem(THROTTLE_KEY, String(Date.now()));
      } catch {}
      if (r.added) onSynced?.();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetch("/api/withings/sync")
      .then((r) => r.json())
      .then((r: Status) => {
        setS(r);
        let last = 0;
        try {
          last = Number(localStorage.getItem(THROTTLE_KEY) ?? 0);
        } catch {}
        if (r.connected && !r.error && Date.now() - last > 10 * 60 * 1000) sync();
      })
      .catch(() => setS(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The app-wide sync (on open) brought in new weigh-ins: refresh the list and the status line.
  useEffect(() => {
    const again = () => {
      onSynced?.();
      fetch("/api/withings/sync").then((r) => r.json()).then(setS).catch(() => {});
    };
    window.addEventListener(WEIGHTS_EVENT, again);
    return () => window.removeEventListener(WEIGHTS_EVENT, again);
  }, [onSynced]);

  if (!s?.available) return null;
  const banner =
    flash === "connected" ? "Withings connected. Your weigh-ins are syncing." : flash === "failed" ? "Couldn't connect Withings. Try again." : null;

  if (!s.connected)
    return (
      <Card className="space-y-2">
        {banner && <p className="text-sm text-danger">{banner}</p>}
        <h2 className="font-semibold">Connect your Withings scale</h2>
        <p className="text-sm text-muted">Weigh-ins (weight and body fat) appear here automatically.</p>
        {s.error && <p className="text-sm text-danger">{s.error}</p>}
        <a href="/api/withings/connect" className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-ink">
          Connect Withings
        </a>
      </Card>
    );

  return (
    <div className="space-y-1 text-center text-xs text-muted">
      {banner && <p className="text-accent">{banner}</p>}
      <p>
        {s.error ? <span className="text-danger">{s.error} </span> : null}
        Withings {syncing ? "syncing…" : s.lastSync ? `synced ${ago(s.lastSync)}` : "connected"} ·{" "}
        <button className="text-accent" onClick={sync} disabled={syncing}>
          Sync now
        </button>
        {s.error && (
          <>
            {" · "}
            <a href="/api/withings/connect" className="text-accent">
              Reconnect
            </a>
          </>
        )}
      </p>
    </div>
  );
}
