"use client";

import { useState } from "react";
import { Button, Card } from "@/components/Card";
import { coachSessions, reviewDue, weeksTraining } from "@/lib/coach";
import { listHealthDays, recoverySummary } from "@/lib/health-store";
import { applyChange, describeChange, weekKey, type Plan, type PlanChange } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import type { Workout } from "@/lib/types";

type Review = { summary: string; changes: PlanChange[] };

/** Weekly Claude review: suggests plan changes, each accepted or skipped by the lifter. */
export function CoachCard({ workouts, plan, onPlan }: { workouts: Workout[]; plan: Plan; onPlan: (p: Plan) => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thisWeek = weekKey();
  const latest = plan.log.find((l) => l.week === thisWeek);

  if (!review && !reviewDue(plan, workouts)) {
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

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const health = await listHealthDays(28).catch(() => []);
      const recovery = health.length ? recoverySummary(health) : null;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.routines, rules: plan.rules, sessions: coachSessions(workouts), weeksTraining: weeksTraining(workouts), recovery }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response" }));
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setReview(data);
      setKeep((data as Review).changes.map((c) => !("error" in applyChange(plan, c))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!review) return;
    setBusy(true);
    setError(null);
    let next = plan;
    const applied: string[] = [];
    const skipped: string[] = [];
    review.changes.forEach((c, i) => {
      if (!keep[i]) return;
      const r = applyChange(next, c);
      if ("error" in r) skipped.push(`${describeChange(next, c)} (${r.error.toLowerCase()})`);
      else {
        applied.push(describeChange(next, c));
        next = r.plan;
      }
    });
    next = { ...next, reviewedWeek: thisWeek, log: [{ week: thisWeek, summary: review.summary, applied }, ...next.log].slice(0, 26) };
    try {
      await planStore.save(next);
      onPlan(next);
      setReview(null);
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
        {!review && <p className="text-sm text-muted">Claude looks at your recent sessions and suggests changes to next week&apos;s plan. Your weights keep adjusting on their own.</p>}
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
                        onClick={() => setKeep((k) => k.map((x, j) => (j === i ? v : x)))}
                        className={`flex-1 py-1.5 ${keep[i] === v ? "bg-accent font-semibold text-accent-ink" : "text-muted"}`}
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
          {busy ? "Reviewing your week…" : "Review my week"}
        </Button>
      )}
    </Card>
  );
}
