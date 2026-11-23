"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Card";
import { CoachCard } from "@/components/CoachCard";
import { FoodToday } from "@/components/FoodToday";
import { NextSession } from "@/components/NextSession";
import { type Plan } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import { hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";
import { useWorkouts } from "@/lib/useWorkouts";
import { totals, weekStreak } from "@/lib/stats";

/** Today: the daily summary. Training details live in the Workout tab. */
export default function Home() {
  const router = useRouter();
  const { workouts, error } = useWorkouts();
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    planStore.get().then(setPlan);
  }, []);

  if (!workouts || !plan) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const active = workouts.find((w) => !w.finishedAt);
  const finished = workouts.filter((w) => w.finishedAt);

  return (
    <main className="page-cols space-y-4">
      <header className="pt-2">
        <p className="text-sm text-muted">{new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="text-2xl font-bold">Today</h1>
      </header>

      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <NextSession workouts={workouts} plan={plan} />

      {!active && <CoachCard workouts={workouts} plan={plan} onPlan={setPlan} />}

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
