"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/Card";
import { coachRows, coachSessions, reviewDue, reviewWeekEnd, weeksTraining } from "@/lib/coach";
import { listHealthDays, recoverySummary } from "@/lib/health-store";
import { plannedMuscleSets, weeklyMuscleSets } from "@/lib/muscles";
import { applyChange, describeChange, weekKey, type Plan, type PlanChange } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import type { Workout } from "@/lib/types";

type Review = { summary: string; changes: PlanChange[] };

/**
 * Weekly Claude review: suggests plan changes, each accepted or skipped by the lifter.
 * It runs by itself the first time Today opens in a new week, and the result is saved with the plan
 * until you act on it, so leaving the page doesn't lose it (or ask Claude again).
 */
export function CoachCard({ workouts, plan, onPlan }: { workouts: Workout[]; plan: Plan; onPlan: (p: Plan) => void }) {
  const [keep, setKeep] = useState<boolean[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);
  const thisWeek = weekKey();
  const latest = plan.log.find((l) => l.week === thisWeek);
  const review: Review | null = plan.pendingReview?.week === thisWeek ? plan.pendingReview : null;
  const due = reviewDue(plan, workouts);
  const choices = keep ?? review?.changes.map((c) => !("error" in applyChange(plan, c))) ?? [];

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const health = await listHealthDays(28).catch(() => []);
      const recovery = health.length ? recoverySummary(health) : null;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.routines,
          rules: plan.rules,
          sessions: coachSessions(workouts),
          weeksTraining: weeksTraining(workouts),
          recovery,
          // Last full week, Monday to Sunday.
          muscleSets: { planned: plannedMuscleSets(plan.routines), lastWeek: weeklyMuscleSets(workouts, 7, reviewWeekEnd()) },
          rows: coachRows(workouts),
        }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response" }));
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      const next = { ...plan, pendingReview: { week: thisWeek, summary: (data as Review).summary, changes: (data as Review).changes } };
      setKeep(null);
      onPlan(next);
      await planStore.save(next).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }, [plan, workouts, thisWeek, onPlan]);

  // Run automatically once per page visit when a review is due and none is waiting.
  useEffect(() => {
    if (due && !review && !tried.current) {
      tried.current = true;
      run();
    }
  }, [due, review, run]);

  if (!review && !due) {
    if (!latest) return null;
    return (
      <Card className="space-y-1">
        <h2 className="font-semibold">This week&apos;s coaching</h2>
        <p className="text-sm text-muted">{latest.summary}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        {latest.applied.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {latest.applied.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  async function apply() {
    if (!review) return;
    setBusy(true);
    setError(null);
    let next = plan;
    const applied: string[] = [];
    const skipped: string[] = [];
    review.changes.forEach((c, i) => {
      if (!choices[i]) return;
      const r = applyChange(next, c);
      if ("error" in r) skipped.push(`${describeChange(next, c)} (${r.error.toLowerCase()})`);
      else {
        applied.push(describeChange(next, c));
        next = r.plan;
      }
    });
    next = { ...next, pendingReview: undefined, reviewedWeek: thisWeek, log: [{ week: thisWeek, summary: review.summary, applied }, ...next.log].slice(0, 26) };
    try {
      await planStore.save(next);
      onPlan(next);
      setKeep(null);
      if (skipped.length) setError(`Not applied: ${skipped.join("; ")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-accent/50">
      <div>
        <h2 className="font-semibold">Weekly review</h2>
        {!review && (
          <p className="text-sm text-muted">
            {busy ? "Claude is looking at last week's sessions…" : "Claude looks at last week's sessions (Monday to Sunday) and suggests changes to this week's plan. Your weights keep adjusting on their own."}
          </p>
        )}
      </div>
      {review && (
        <>
          <p className="text-sm">{review.summary}</p>
          {review.changes.length === 0 ? (
            <p className="text-sm text-muted">No changes this week. Keep going as you are.</p>
          ) : (
            <ul className="space-y-2">
              {review.changes.map((c, i) => (
                <li key={i} className="rounded-xl border border-line bg-card-2 p-3">
                  <p className="text-sm font-medium">{describeChange(plan, c)}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.reason}</p>
                  {(() => {
                    const r = applyChange(plan, c);
                    return "error" in r ? <p className="mt-1 text-xs text-danger">Can&apos;t apply: {r.error.toLowerCase()}</p> : null;
                  })()}
                  <div className="mt-2 flex overflow-hidden rounded-lg border border-line text-xs">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => setKeep(choices.map((x, j) => (j === i ? v : x)))}
                        className={`flex-1 py-1.5 ${choices[i] === v ? "bg-accent font-semibold text-accent-ink" : "text-muted"}`}
                      >
                        {v ? "Accept" : "Skip"}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{error}</p>}
      {review ? (
        <Button className="w-full" onClick={apply} disabled={busy}>
          {busy ? "Saving…" : review.changes.length ? "Update my plan" : "Got it"}
        </Button>
      ) : (
        <Button className="w-full" onClick={run} disabled={busy}>
          {busy ? "Reviewing your week…" : error ? "Try again" : "Review my week"}
        </Button>
      )}
    </Card>
  );
}
