"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/Card";
import { LiftLine } from "@/components/Charts";
import { healthError, listHealthDays, listHealthWorkouts, recoverySummary } from "@/lib/health-store";
import { onNative, postNative, useIsNativeApp, type HealthDay, type HealthWorkout } from "@/lib/native";

const trend = (now: number | null, before: number | null, unit: string) => {
  if (now == null) return "–";
  if (before == null || Math.abs(now - before) < (unit === "h" ? 0.2 : 1)) return `${now} ${unit}`;
  return `${now} ${unit} ${now > before ? "↑" : "↓"}`;
};

/** Sleep, resting heart rate, HRV and rows from Apple Health (synced by the iPhone app). */
export function HealthCard() {
  const native = useIsNativeApp();
  const [days, setDays] = useState<HealthDay[] | null>(null);
  const [rows, setRows] = useState<HealthWorkout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([listHealthDays(28), listHealthWorkouts(28)])
      .then(([d, w]) => {
        setDays(d);
        setRows(w);
        setError(null);
      })
      .catch((e) => {
        setDays([]);
        setError(healthError(e));
      });

  useEffect(() => {
    load();
    const saved = (e: Event) => {
      const err = (e as CustomEvent<string | undefined>).detail;
      setBusy(false);
      if (err) setError(err);
      else load();
    };
    window.addEventListener("nicholasfit-health-saved", saved);
    const off = onNative((m) => {
      if (m.type === "healthData" && m.error) {
        setError(m.error);
        setBusy(false);
      }
    });
    return () => {
      window.removeEventListener("nicholasfit-health-saved", saved);
      off();
    };
  }, []);

  const sync = () => {
    setBusy(true);
    setError(null);
    postNative({ type: "healthSync", days: 28 });
  };

  if (!days) return null;
  if (!days.length && !native) return null;
  const s = recoverySummary(days);
  const sleepPoints = days.filter((d) => d.sleepMin != null).map((d) => ({ date: d.day, value: Math.round((d.sleepMin! / 60) * 10) / 10 }));

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Recovery · Apple Health</h2>
        {native && (
          <button
            className="text-sm text-accent disabled:opacity-50"
            disabled={busy}
            onClick={sync}
          >
            {busy ? "Syncing…" : "Sync"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {days.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Bring in sleep, resting heart rate, HRV, steps and your Concept2 rows from Apple Health. Your weekly coaching uses them to judge recovery.</p>
          {native && (
            <Button
              disabled={busy}
              onClick={sync}
            >
              Connect Apple Health
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold tabular-nums">{trend(s.sleepHours, s.sleepHoursBefore, "h")}</p>
              <p className="text-xs text-muted">Sleep / night</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{trend(s.restingHr, s.restingHrBefore, "bpm")}</p>
              <p className="text-xs text-muted">Resting HR</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{trend(s.hrvMs, s.hrvMsBefore, "ms")}</p>
              <p className="text-xs text-muted">HRV</p>
            </div>
          </div>
          <p className="text-xs text-muted">7-day averages; arrows compare with the 3 weeks before.{s.steps != null ? ` Steps ${s.steps.toLocaleString("en-AU")} a day.` : ""}</p>
          {sleepPoints.length > 2 && <LiftLine name="Sleep" unit="h" points={sleepPoints} />}
        </>
      )}
      {rows.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Rows from Apple Health</h3>
          <ul className="space-y-1 text-sm">
            {rows.slice(0, 5).map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>
                  {r.distanceM ? `${r.distanceM.toLocaleString("en-AU")} m` : "Row"} · {Math.round(r.minutes)} min
                </span>
                <span className="shrink-0 text-muted">{new Date(r.startedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
