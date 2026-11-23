"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/Card";
import { formatDate, formatDuration, startOfWeek } from "@/lib/format";
import { doneSetCount, nextRoutineKey, workoutSummary } from "@/lib/progression";
import { DEFAULT_PLAN, planRoutines, type Plan } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import { CoachCard } from "@/components/CoachCard";
import { startWorkout } from "@/lib/start";
import { hasNativeWorkout, openOnPhone, postNative } from "@/lib/native";
import { hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";
import { useWorkouts } from "@/lib/useWorkouts";
import { WEEKLY_GOAL, totals, weekStreak } from "@/lib/stats";
import { FoodToday } from "@/components/FoodToday";

export default function Home() {
  const router = useRouter();
  const { workouts, error } = useWorkouts();
  const [starting, setStarting] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    planStore.get().then(setPlan);
  }, []);

  if (!workouts || !plan) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const active = workouts.find((w) => !w.finishedAt);
  const finished = workouts.filter((w) => w.finishedAt);
  const nextKey = nextRoutineKey(workouts);
  const routines = planRoutines(plan ?? DEFAULT_PLAN);
  const next = routines.find((r) => r.key === nextKey)!;
  const weekStart = startOfWeek().toISOString();
  const strengthThisWeek = finished.filter((w) => w.startedAt >= weekStart && (w.templateKey === "A" || w.templateKey === "B" || w.templateKey === null)).length;

  async function start(key: string | null) {
    setStarting(key ?? "custom");
    if (hasNativeWorkout()) {
      // The iPhone app's own workout screen builds and runs it, signal or not.
      postNative({ type: "startWorkout", key, snapshot: { plan: plan!, history: finished.slice(0, 60) } });
      setTimeout(() => setStarting(null), 1500);
      return;
    }
    const id = await startWorkout(workouts!, key, plan!);
    router.push(`/workout/${id}`);
  }

  return (
    <main className="page-cols space-y-4">
      <header className="pt-2">
        <p className="text-sm text-muted">{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-2xl font-bold">Today</h1>
      </header>

      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {active ? (
        <Card className="border-accent/50">
          <p className="text-sm text-muted">In progress</p>
          <h2 className="text-lg font-semibold">{active.name}</h2>
          <p className="mb-3 text-sm text-muted">Started {formatDate(active.startedAt)}, {doneSetCount(active)} sets done</p>
          {hasNativeWorkout() ? (
            <button className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-ink" onClick={() => openOnPhone(active)}>
              Resume workout
            </button>
          ) : (
            <Link href={`/workout/${active.id}`} className="block rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-ink">
              Resume workout
            </Link>
          )}
        </Card>
      ) : (
        <div className="rounded-3xl bg-hero p-5 text-hero-ink shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Next session</p>
          <h2 className="mt-1 text-2xl font-bold">{next.name}</h2>
          <p className="mb-4 mt-1 text-sm opacity-80">{next.summary} · about 45 min</p>
          <button
            className="w-full rounded-xl bg-white py-3.5 text-base font-semibold text-[#0b4d34] active:opacity-80 disabled:opacity-60"
            onClick={() => start(nextKey)}
            disabled={!!starting}
          >
            {starting === nextKey ? "Starting…" : `Start ${next.name}`}
          </button>
          <div className="mt-3 flex gap-2">
            {routines.filter((r) => r.key !== nextKey).map((r) => (
              <button key={r.key} className="flex-1 rounded-xl bg-white/15 px-2 py-3 text-sm font-medium active:opacity-80 disabled:opacity-60" onClick={() => start(r.key)} disabled={!!starting}>
                {r.name}
              </button>
            ))}
            <button className="flex-1 rounded-xl bg-white/15 px-2 py-3 text-sm font-medium active:opacity-80 disabled:opacity-60" onClick={() => start(null)} disabled={!!starting}>
              Empty
            </button>
          </div>
        </div>
      )}

      {!active && <CoachCard workouts={workouts} plan={plan} onPlan={setPlan} />}

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">This week</h2>
          <span className="text-sm text-muted">
            {Math.min(strengthThisWeek, WEEKLY_GOAL)} of {WEEKLY_GOAL} sessions
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: WEEKLY_GOAL }, (_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i < strengthThisWeek ? "bg-accent" : "bg-card-2"}`} />
          ))}
        </div>
      </Card>

      <FoodToday />

      {finished.length > 0 && (
        <Link href="/progress" className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
          <span>
            <span className="block font-semibold">Your progress</span>
            <span className="text-sm text-muted">
              {totals(workouts).workouts} workouts · {weekStreak(workouts)} week streak
            </span>
          </span>
          <span className="text-accent">›</span>
        </Link>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Recent</h2>
          <Link href="/history" className="text-sm text-accent">
            All history
          </Link>
        </div>
        {finished.length === 0 ? (
          <p className="text-sm text-muted">No workouts yet. Your first session sets your starting weights.</p>
        ) : (
          <ul className="space-y-2">
            {finished.slice(0, 3).map((w) => (
              <li key={w.id}>
                <Link href={`/workout/${w.id}`} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3">
                  <span>
                    <span className="block font-medium">{w.name}</span>
                    <span className="text-sm text-muted">
                      {formatDate(w.startedAt)} · {formatDuration(w.startedAt, w.finishedAt)}
                    </span>
                  </span>
                  <span className="text-right text-sm text-muted">
                    {workoutSummary(w)[0]}
                    <br />
                    {workoutSummary(w)[1]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasSupabase && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await supabase().auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      )}
    </main>
  );
}
