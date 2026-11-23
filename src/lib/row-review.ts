import { foodStore } from "./food-store";
import { listHealthDays, recoverySummary } from "./health-store";
import { planStore } from "./plan-store";
import type { Plan } from "./plan";
import { easyRange, maxHeartRate } from "./row";
import { type RowCoaching, easySplit, fourByFourUnlocked, getRowSession, harderRows, zonesMax } from "./row-sessions";
import type { RowPiece, Workout } from "./types";

export const emptyCoaching = (): RowCoaching => ({ targets: {}, fourByFourUnlocked: false, measuredMaxHr: null });

const compact = (w: Workout, p: RowPiece) => ({
  date: w.startedAt.slice(0, 10),
  session: p.session,
  targetSplitS: p.targetSplitS ?? null,
  totalM: p.distanceM,
  minutes: Math.round(p.seconds / 6) / 10,
  avgHr: p.avgHr,
  maxHr: p.maxHr,
  reps: (p.reps ?? []).map((r) => ({ splitS: r.splitS, spm: r.avgSpm, watts: r.avgWatts, maxHr: r.maxHr, hrAfterEasy: r.hrAfterEasy })),
});

/**
 * Ask Claude to review a finished guided row, then save the new target, the 4 × 4 unlock and any
 * higher measured max heart rate into the plan. Returns the updated plan.
 */
export async function reviewRow(workout: Workout, history: Workout[], plan: Plan): Promise<Plan> {
  const piece = workout.entries.flatMap((e) => e.sets.filter((s) => s.done && s.row?.session).map((s) => s.row as RowPiece))[0];
  const session = getRowSession(piece?.session);
  if (!piece || !session) throw new Error("No guided row to review");
  const others = history.filter((w) => w.id !== workout.id);
  const [profile, days] = await Promise.all([foodStore.getProfile().catch(() => null), listHealthDays(28).catch(() => [])]);
  const coaching = plan.rowCoaching ?? emptyCoaching();
  const max = zonesMax(profile?.birthYear ?? null, coaching);
  const recent = harderRows(others)
    .filter((r) => r.piece)
    .slice(0, 8)
    .map((r) => compact(r.workout, r.piece!));
  const res = await fetch("/api/row-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      row: compact(workout, piece),
      recent,
      easySplitS: easySplit(others),
      zones: max ? { maxHr: max, measured: coaching.measuredMaxHr != null, zone2: easyRange(max), zone4: [Math.round(max * 0.8), Math.round(max * 0.9)] } : null,
      recovery: days.length ? recoverySummary(days) : null,
      harderRowsDone: harderRows(history).length,
      unlocked: fourByFourUnlocked(history, coaching),
    }),
  });
  const out = (await res.json().catch(() => ({}))) as { summary?: string; nextTargetSplitS?: number; targetNote?: string; unlockFourByFour?: boolean; error?: string };
  if (!res.ok || !out.summary) throw new Error(out.error ?? "Couldn't review this row.");

  // A hard rep's peak above the age estimate means the estimate is too low for you: use the real one.
  const peak = Math.max(0, ...(piece.reps ?? []).map((r) => r.maxHr ?? 0), piece.maxHr ?? 0);
  const est = profile?.birthYear ? maxHeartRate(profile.birthYear) : 0;
  const measuredMaxHr = peak > Math.max(est, coaching.measuredMaxHr ?? 0) ? peak : coaching.measuredMaxHr;
  const at = new Date().toISOString();
  const next: Plan = {
    ...plan,
    rowCoaching: {
      ...coaching,
      measuredMaxHr,
      fourByFourUnlocked: coaching.fourByFourUnlocked || !!out.unlockFourByFour || fourByFourUnlocked(history, coaching),
      targets: { ...coaching.targets, ...(out.nextTargetSplitS ? { [session.key]: { splitS: out.nextTargetSplitS, note: out.targetNote ?? "", at } } : {}) },
      lastReview: { workoutId: workout.id, summary: out.summary, at },
    },
  };
  await planStore.save(next);
  return next;
}
