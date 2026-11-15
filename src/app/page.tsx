"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/Card";
import { formatDate, formatDuration, formatKg, startOfWeek } from "@/lib/format";
import { doneSetCount, nextRoutineKey, volumeKg } from "@/lib/progression";
import { ROUTINES, getRoutine } from "@/lib/routines";
import { startWorkout } from "@/lib/start";
import { hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";
import { useWorkouts } from "@/lib/useWorkouts";

const WEEKLY_GOAL = 3;

export default function Home() {
  const router = useRouter();
  const { workouts, error } = useWorkouts();
  const [starting, setStarting] = useState<string | null>(null);

  if (!workouts) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const active = workouts.find((w) => !w.finishedAt);
  const finished = workouts.filter((w) => w.finishedAt);
  const nextKey = nextRoutineKey(workouts);
  const next = getRoutine(nextKey)!;
  const weekStart = startOfWeek().toISOString();
  const strengthThisWeek = finished.filter((w) => w.startedAt >= weekStart && (w.templateKey === "A" || w.templateKey === "B" || w.templateKey === null)).length;

  async function start(key: string | null) {
    setStarting(key ?? "custom");
    const id = await startWorkout(workouts!, key);
    router.push(`/workout/${id}`);
  }

  return (
    <main className="space-y-4">
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
          <Link href={`/workout/${active.id}`} className="block rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-ink">
            Resume workout
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">Next session</p>
          <h2 className="text-lg font-semibold">{next.name}</h2>
          <p className="mb-3 text-sm text-muted">{next.summary} · about 45 min</p>
          <Button className="w-full" onClick={() => start(nextKey)} disabled={!!starting}>
            {starting === nextKey ? "Starting…" : `Start ${next.name}`}
          </Button>
          <div className="mt-3 flex gap-2">
            {ROUTINES.filter((r) => r.key !== nextKey).map((r) => (
              <Button key={r.key} variant="secondary" className="flex-1 !px-2" onClick={() => start(r.key)} disabled={!!starting}>
                {r.name}
              </Button>
            ))}
            <Button variant="secondary" className="flex-1 !px-2" onClick={() => start(null)} disabled={!!starting}>
              Empty
            </Button>
          </div>
        </Card>
      )}

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
                    {doneSetCount(w)} sets
                    <br />
                    {formatKg(volumeKg(w))}
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
