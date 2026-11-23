"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/Card";
import { formatDate } from "@/lib/format";
import { hasNativeWorkout, openOnPhone, postNative } from "@/lib/native";
import { planRoutines, type Plan } from "@/lib/plan";
import { doneSetCount, nextRoutineKey } from "@/lib/progression";
import { startWorkout } from "@/lib/start";
import type { Workout } from "@/lib/types";

/**
 * Resume the workout in progress, or start the next one. `full` (Workout tab) also offers the other
 * routines and an empty workout; the compact version (Today) is a single Start button.
 */
export function NextSession({ workouts, plan, full = false }: { workouts: Workout[]; plan: Plan; full?: boolean }) {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const active = workouts.find((w) => !w.finishedAt);
  const finished = workouts.filter((w) => w.finishedAt);
  const nextKey = nextRoutineKey(workouts);
  const routines = planRoutines(plan);
  const next = routines.find((r) => r.key === nextKey) ?? routines[0];

  async function start(key: string | null) {
    setStarting(key ?? "custom");
    if (hasNativeWorkout()) {
      // The iPhone app's own workout screen builds and runs it, signal or not.
      postNative({ type: "startWorkout", key, snapshot: { plan, history: finished.slice(0, 60) } });
      setTimeout(() => setStarting(null), 1500);
      return;
    }
    const id = await startWorkout(workouts, key, plan);
    router.push(`/workout/${id}`);
  }

  if (active)
    return (
      <Card className="border-accent/50">
        <p className="text-sm text-muted">In progress</p>
        <h2 className="text-lg font-semibold">{active.name}</h2>
        <p className="mb-3 text-sm text-muted">
          Started {formatDate(active.startedAt)}, {doneSetCount(active)} sets done
        </p>
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
    );

  return (
    <div className="rounded-3xl bg-hero p-5 text-hero-ink shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Next session</p>
      <h2 className="mt-1 text-2xl font-bold">{next.name}</h2>
      <p className="mb-4 mt-1 text-sm opacity-80">{next.summary} · about 45 min</p>
      <button
        className="w-full rounded-xl bg-white py-3.5 text-base font-semibold text-[#0b4d34] active:opacity-80 disabled:opacity-60"
        onClick={() => start(next.key)}
        disabled={!!starting}
      >
        {starting === next.key ? "Starting…" : `Start ${next.name}`}
      </button>
      {full && (
        <div className="mt-3 flex gap-2">
          {routines
            // Rows live on the Row tab.
            .filter((r) => r.key !== next.key && !r.key.startsWith("ROW"))
            .map((r) => (
              <button key={r.key} className="flex-1 rounded-xl bg-white/15 px-2 py-3 text-sm font-medium active:opacity-80 disabled:opacity-60" onClick={() => start(r.key)} disabled={!!starting}>
                {r.name}
              </button>
            ))}
          <button className="flex-1 rounded-xl bg-white/15 px-2 py-3 text-sm font-medium active:opacity-80 disabled:opacity-60" onClick={() => start(null)} disabled={!!starting}>
            Empty
          </button>
        </div>
      )}
    </div>
  );
}
