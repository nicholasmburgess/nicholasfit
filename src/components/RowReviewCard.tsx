"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import { formatSplit } from "@/lib/row";
import { getRowSession } from "@/lib/row-sessions";
import { reviewRow } from "@/lib/row-review";
import type { Workout } from "@/lib/types";

/**
 * Claude's review of a finished guided row: runs once by itself, then shows the summary and the
 * target it set for next time. Shown on the finish summary and the Row tab.
 */
export function RowReviewCard({ workout, history, onPlan }: { workout: Workout; history: Workout[]; onPlan?: (p: Plan) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);
  const piece = workout.entries.flatMap((e) => e.sets.filter((s) => s.done && s.row?.session).map((s) => s.row!))[0];
  const session = getRowSession(piece?.session);

  useEffect(() => {
    planStore.get().then(setPlan);
  }, []);

  const reviewed = plan?.rowCoaching?.lastReview?.workoutId === workout.id ? plan.rowCoaching.lastReview : null;

  async function run() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const next = await reviewRow(workout, history, plan);
      setPlan(next);
      onPlan?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't review this row.");
    } finally {
      setBusy(false);
    }
  }

  // Review a row once, by itself, the first time it's shown (only the newest one, so old rows aren't re-reviewed).
  const newest = !plan?.rowCoaching?.lastReview || plan.rowCoaching.lastReview.at < (workout.finishedAt ?? "");
  useEffect(() => {
    if (plan && session && !reviewed && newest && !tried.current) {
      tried.current = true;
      run();
    }
  });

  if (!session || !piece) return null;
  const target = plan?.rowCoaching?.targets[session.key];
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h3 className="font-semibold">Claude&apos;s review · {session.name}</h3>
      {reviewed ? (
        <>
          <p className="mt-2 text-sm">{reviewed.summary}</p>
          {target && (
            <p className="mt-2 text-sm font-semibold text-accent">
              Next time: hard parts at {formatSplit(target.splitS, false)} /500m{target.note ? <span className="font-normal text-muted"> · {target.note}</span> : null}
            </p>
          )}
        </>
      ) : busy ? (
        <p className="mt-2 text-sm text-muted">Reviewing your reps…</p>
      ) : (
        <>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button className="mt-2 w-full rounded-xl border border-accent/40 py-2.5 text-sm font-semibold text-accent" onClick={run} disabled={!plan}>
            Review this row
          </button>
        </>
      )}
    </section>
  );
}
