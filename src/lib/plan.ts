import { isAdjustable, MAX_ADJUSTABLE_SETUPS } from "./adjustable";
import { getExercise } from "./exercises";
import type { RowCoaching } from "./row-sessions";
import { ROUTINES, type Routine } from "./routines";

// Pure plan logic, shared with the iPhone app. Loading and saving live in plan-store.ts.

export type PlanChange = {
  routine: string;
  action: "swap" | "set_target" | "add" | "remove";
  exerciseId: string;
  newExerciseId?: string;
  sets?: number;
  repMin?: number;
  repMax?: number;
  reason: string;
};

export type Plan = {
  /** Strength routines the coach may change (A and B). */
  routines: Routine[];
  /** Monday (YYYY-MM-DD) of the last weekly review, accepted or not. */
  reviewedWeek: string | null;
  log: { week: string; summary: string; applied: string[] }[];
  /** The lifter's standing rules the coach must follow, e.g. room limits. */
  rules: string[];
  /** Targets, measured max heart rate and 4 × 4 unlock from the per-row Claude review. */
  rowCoaching?: RowCoaching;
  /** A weekly review that has been run but not yet accepted or skipped, so it isn't lost (or re-run) when you leave the page. */
  pendingReview?: { week: string; summary: string; changes: PlanChange[] };
  /** Built-in plan updates applied so far (see upgradePlan). */
  version?: number;
};

export const PLAN_VERSION = 2;

export const DEFAULT_RULES = ["Low ceiling: never lift weight overhead while standing. Seated overhead pressing on a bench is fine."];

export const COACHED = ["A", "B"];

export const DEFAULT_PLAN: Plan = {
  routines: ROUTINES.filter((r) => COACHED.includes(r.key)),
  reviewedWeek: null,
  log: [],
  rules: DEFAULT_RULES,
  version: PLAN_VERSION,
};

/**
 * One-off updates to a saved plan when the app's default plan improves. Each only applies when that part
 * of the plan is still as it started, so the coach's and your own changes are kept.
 * v2: bench press 3 → 4 sets, and a cable curl + rope pushdown superset in Strength A (chest, biceps and
 * triceps were at about 4.5 weekly sets against the ~10 the app aims for).
 */
export function upgradePlan(plan: Plan): Plan {
  if ((plan.version ?? 1) >= PLAN_VERSION) return plan;
  const routines = plan.routines.map((r) => {
    if (r.key !== "A") return r;
    const fresh = ROUTINES.find((x) => x.key === "A")!;
    let items = r.items.map((i) => (i.exerciseId === "Barbell_Bench_Press_-_Medium_Grip" && i.target.sets === 3 ? { ...i, target: { ...i.target, sets: 4 } } : i));
    const arms = fresh.items.filter((i) => i.group === "arms");
    if (items.length <= 5 && !arms.some((a) => items.some((i) => i.exerciseId === a.exerciseId))) items = [...items, ...arms];
    return { ...r, items };
  });
  return { ...plan, routines, version: PLAN_VERSION };
}

/** All routines to offer: the plan's strength days plus fixed extras like the easy row. */
export function planRoutines(plan: Plan): Routine[] {
  return [
    ...plan.routines.map((r) => ({ ...r, summary: routineSummary(r) })),
    // 4 × 4 is the hardest session: offered once three harder rows are done (or the review unlocks it).
    ...ROUTINES.filter((r) => !COACHED.includes(r.key) && (r.key !== "ROW_4X4" || plan.rowCoaching?.fourByFourUnlocked)),
  ];
}

export function routineSummary(r: Routine): string {
  const names = r.items.map((i) => getExercise(i.exerciseId)?.name ?? i.exerciseId);
  return names.join(", ");
}

export function weekKey(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Plain-English one-liner for a change, e.g. "Strength A: swap Goblet Squat for Back Squat". */
export function describeChange(plan: Plan, c: PlanChange): string {
  const r = plan.routines.find((x) => x.key === c.routine);
  const n = (id?: string) => (id ? (getExercise(id)?.name ?? id) : "");
  const where = r?.name ?? c.routine;
  const target = c.sets ? `${c.sets} × ${c.repMin}–${c.repMax}` : "";
  switch (c.action) {
    case "swap":
      return `${where}: swap ${n(c.exerciseId)} for ${n(c.newExerciseId)}${target ? ` (${target})` : ""}`;
    case "set_target":
      return `${where}: ${n(c.exerciseId)} becomes ${target}`;
    case "add":
      return `${where}: add ${n(c.exerciseId)}${target ? ` (${target})` : ""}`;
    case "remove":
      return `${where}: drop ${n(c.exerciseId)}`;
  }
}

/** Apply one change. Returns the new plan, or an error when it breaks a rule. */
export function applyChange(plan: Plan, c: PlanChange): { plan: Plan } | { error: string } {
  const ri = plan.routines.findIndex((r) => r.key === c.routine);
  if (ri < 0) return { error: "Unknown routine" };
  const r = plan.routines[ri];
  const idx = r.items.findIndex((i) => i.exerciseId === c.exerciseId);
  const items = [...r.items];
  const tgt = (base = { sets: 3, repMin: 8, repMax: 12, restSec: 90 }) => ({
    ...base,
    ...(c.sets ? { sets: Math.min(5, Math.max(1, c.sets)) } : {}),
    ...(c.repMin && c.repMax && c.repMin <= c.repMax ? { repMin: c.repMin, repMax: c.repMax } : {}),
  });
  if (c.action === "add") {
    if (!getExercise(c.exerciseId)) return { error: "Unknown exercise" };
    if (idx >= 0) return { error: "Already in this routine" };
    items.push({ exerciseId: c.exerciseId, target: tgt() });
  } else {
    if (idx < 0) return { error: "Not in this routine" };
    if (c.action === "remove") {
      if (items.length <= 3) return { error: "Keeps at least 3 exercises" };
      items.splice(idx, 1);
    } else if (c.action === "set_target") {
      items[idx] = { ...items[idx], target: tgt(items[idx].target) };
    } else {
      if (!c.newExerciseId || !getExercise(c.newExerciseId)) return { error: "Unknown exercise" };
      if (items.some((i) => i.exerciseId === c.newExerciseId)) return { error: "Already in this routine" };
      items[idx] = { exerciseId: c.newExerciseId, target: tgt(items[idx].target), ...(items[idx].group ? { group: items[idx].group } : {}) };
    }
  }
  if (items.filter((i) => isAdjustable(i.exerciseId)).length > MAX_ADJUSTABLE_SETUPS)
    return { error: "Would need more than two dumbbell/kettlebell settings" };
  const routines = [...plan.routines];
  routines[ri] = { ...r, items };
  return { plan: { ...plan, routines } };
}
