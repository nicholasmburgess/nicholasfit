"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { NextSession } from "@/components/NextSession";
import { foodStore } from "@/lib/food-store";
import { formatDate, formatDuration, startOfWeek } from "@/lib/format";
import { getExercise } from "@/lib/exercises";
import { weightsCsv, workoutsCsv } from "@/lib/export";
import { isNativeApp, postNative } from "@/lib/native";
import { COACHED, DEFAULT_PLAN, planRoutines, type Plan } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import { workoutSummary } from "@/lib/progression";
import { WEEKLY_GOAL } from "@/lib/stats";
import { useWorkouts } from "@/lib/useWorkouts";

/** Save a CSV: the iPhone app opens the share sheet (Files, Mail, AirDrop); a browser downloads it. */
function saveCsv(name: string, text: string) {
  if (isNativeApp()) return postNative({ type: "shareFile", name, mime: "text/csv", text });
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Everything training: start or resume, this week, your routines, and every past workout. */
export default function WorkoutsPage() {
  const { workouts, error } = useWorkouts();
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    planStore.get().then(setPlan);
  }, []);
  if (!workouts || !plan) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const finished = workouts.filter((w) => w.finishedAt);
  const weekStart = startOfWeek().toISOString();
  const strengthThisWeek = finished.filter((w) => w.startedAt >= weekStart && (w.templateKey === "A" || w.templateKey === "B" || w.templateKey === null)).length;
  const routines = planRoutines(plan ?? DEFAULT_PLAN).filter((r) => COACHED.includes(r.key));

  const groups = new Map<string, typeof finished>();
  for (const w of finished) {
    const k = new Date(w.startedAt).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }

  return (
    <main className="space-y-4 md:mx-auto md:max-w-3xl">
      <h1 className="pt-2 text-2xl font-bold">Workout</h1>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <NextSession workouts={workouts} plan={plan} full />

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
        <h2 className="mb-2 font-semibold">Your routines</h2>
        <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
          {routines.map((r) => (
            <details key={r.key} className="rounded-xl border border-line bg-card px-4 py-3">
              <summary className="cursor-pointer font-medium">
                {r.name} <span className="text-sm font-normal text-muted">· {r.items.length} exercises</span>
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {r.items.map((i) => (
                  <li key={i.exerciseId} className="flex justify-between gap-2">
                    <span>{getExercise(i.exerciseId)?.name ?? i.exerciseId}</span>
                    <span className="shrink-0 text-muted">
                      {i.target.sets} × {i.target.repMin}–{i.target.repMax}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">The weekly coach on Today suggests changes to these.</p>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Past workouts</h2>
        {finished.length === 0 && <p className="text-sm text-muted">No workouts yet. Your first session sets your starting weights.</p>}
        {[...groups].map(([month, ws]) => (
          <div key={month}>
            <h3 className="mb-2 text-sm font-semibold text-muted">
              {month} · {ws.length} {ws.length === 1 ? "workout" : "workouts"}
            </h3>
            <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
              {ws.map((w) => (
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
          </div>
        ))}
        {finished.length > 0 && (
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl border border-line bg-card py-2.5 text-sm font-medium" onClick={() => saveCsv(`nicholasfit-workouts-${new Date().toISOString().slice(0, 10)}.csv`, workoutsCsv(workouts))}>
              Export workouts (CSV)
            </button>
            <button
              className="flex-1 rounded-xl border border-line bg-card py-2.5 text-sm font-medium"
              onClick={async () => saveCsv(`nicholasfit-body-weight-${new Date().toISOString().slice(0, 10)}.csv`, weightsCsv(await foodStore.listWeights().catch(() => [])))}
            >
              Export body weight (CSV)
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
