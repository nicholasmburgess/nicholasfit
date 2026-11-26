"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { LiftLine, WeeklyBars } from "@/components/Charts";
import { WEEKLY_GOAL, liftSeries, recentRecords, totals, weekStreak, weeklyTotals } from "@/lib/stats";
import { useWorkouts } from "@/lib/useWorkouts";
import { useEffect, useState } from "react";
import { foodStore } from "@/lib/food-store";
import { WidgetCard } from "@/components/WidgetCard";
import { WithingsCard } from "@/components/WithingsCard";
import { RemindersCard } from "@/components/RemindersCard";
import { WaistCard } from "@/components/WaistCard";
import { HealthCard } from "@/components/HealthCard";
import { MuscleSetsCard } from "@/components/MuscleSetsCard";
import { CheckinCard } from "@/components/CheckinCard";
import type { Checkin } from "@/lib/checkin";
import { loadCheckin } from "@/lib/checkin-load";
import type { WeightEntry } from "@/lib/types";

export default function ProgressPage() {
  const { workouts, error } = useWorkouts();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const loadWeights = async () => {
    try {
      const [w, profile] = await Promise.all([foodStore.listWeights(), foodStore.getProfile()]);
      setWeights(w);
      setCheckin(profile ? await loadCheckin(profile, w) : null);
    } catch {
      setWeights([]);
    }
  };
  useEffect(() => {
    loadWeights();
  }, []);
  if (!workouts) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const t = totals(workouts);
  const weeks = weeklyTotals(workouts, 12);
  const lifts = liftSeries(workouts);
  const records = recentRecords(workouts);
  const streak = weekStreak(workouts);
  const tiles = [
    { label: "Workouts", value: String(t.workouts) },
    { label: "Week streak", value: String(streak) },
    { label: "Total lifted", value: t.volume >= 1000 ? `${(t.volume / 1000).toFixed(1)} t` : `${Math.round(t.volume)} kg` },
    { label: "Time trained", value: t.minutes >= 60 ? `${Math.round(t.minutes / 60)} h` : `${Math.round(t.minutes)} min` },
  ];

  return (
    <main className="page-cols space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-sm text-muted">Everything since you started</p>
      </header>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{x.value}</p>
            <p className="text-xs text-muted">{x.label}</p>
          </div>
        ))}
      </div>

      {checkin && <CheckinCard c={checkin} />}

      {t.workouts === 0 ? (
        <Card>
          <p className="text-sm text-muted">Finish your first workout and your charts will start here.</p>
          <Link href="/workouts" className="mt-3 block text-sm text-accent">
            Go to Workout
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="font-semibold">Sessions per week</h2>
            <WeeklyBars data={weeks.map((w) => ({ label: w.label, value: w.sessions }))} goal={WEEKLY_GOAL} format={(v) => `${v} ${v === 1 ? "session" : "sessions"}`} label="Sessions per week, last 12 weeks" />
          </Card>

          <MuscleSetsCard workouts={workouts} />

          <Card>
            <h2 className="font-semibold">Weight lifted per week</h2>
            <WeeklyBars data={weeks.map((w) => ({ label: w.label, value: Math.round(w.volume) }))} format={(v) => `${v.toLocaleString("en-AU")} kg`} label="Weight lifted per week, last 12 weeks" />
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">Main lifts · heaviest set each session</h2>
            {lifts.map((l) => (
              <Link key={l.exerciseId} href={`/exercises/${l.exerciseId}`} className="block">
                <LiftLine points={l.points} unit={l.unit} name={l.name} />
              </Link>
            ))}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Recent records</h2>
            {records.length === 0 ? (
              <p className="text-sm text-muted">Beat a previous session and your records appear here.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {records.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>★ {r.text}</span>
                    <span className="shrink-0 text-muted">{new Date(r.date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <WithingsCard onSynced={loadWeights} />
      {weights.length > 0 ? (
        <Card>
          <h2 className="mb-2 font-semibold">Body weight</h2>
          {weights.at(-1)!.fatPct != null && <p className="mb-1 text-sm text-muted">Body fat {weights.at(-1)!.fatPct}%</p>}
          <LiftLine name={`${Math.round(weights.at(-1)!.kg * 10) / 10} kg`} unit="kg" points={weights.map((w) => ({ date: w.measuredAt, value: w.kg }))} />
        </Card>
      ) : (
        <Card className="border-dashed">
          <h2 className="font-semibold">Body weight</h2>
          <p className="text-sm text-muted">Log your weight on the Food tab, or connect your Withings scale, and your trend appears here.</p>
        </Card>
      )}
      <WaistCard />
      <HealthCard />
      <RemindersCard />
      <WidgetCard />
    </main>
  );
}
