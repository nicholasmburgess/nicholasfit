import type { Plan } from "./plan";
import { ROW_EXERCISE, maxHeartRate } from "./row";
import type { Entry, RowPiece, Workout } from "./types";

/**
 * Guided rowing sessions. The PM5 runs "Just Row"; the phone times each part from the PM5's clock.
 *
 * Evidence used:
 * - Easy, zone 2 rowing builds the aerobic base and is most of a beginner's cardio.
 * - Short intervals (1 min hard / 1 min easy) improve fitness in little time and suit beginners
 *   because each rep is short enough to hold good form (Gibala et al. 2012; Milanović et al. 2015).
 * - 4 × 4 min at 85–95% of max heart rate with 3 min active recovery raised VO₂max more than
 *   steady training at the same total work (Helgerud et al. 2007). It's the hardest, so it unlocks
 *   once three harder rows are done.
 * - Tempo (threshold-type) pieces in zone 3 sit between the two.
 * - One harder session a week alongside three strength days keeps interference with strength
 *   gains small (Wilson et al. 2012: interference grows with cardio frequency and duration).
 */

export type RowSessionKey = "ROW_TEMPO" | "ROW_1MIN" | "ROW_4X4";
export type SegmentKind = "warmup" | "work" | "easy" | "cooldown";
export type Segment = { kind: SegmentKind; seconds: number; /** Heart-rate zone to aim for. */ zone: [number, number] };

export type RowSession = {
  key: RowSessionKey;
  name: string;
  short: string;
  description: string;
  /** Hard reps' heart-rate zone, for the guide. */
  workZone: [number, number];
  /** How much faster than your easy-row split the first hard target is (seconds per 500 m). */
  firstTargetOffsetS: number;
  segments: Segment[];
};

const warm = (min: number): Segment => ({ kind: "warmup", seconds: min * 60, zone: [1, 2] });
const cool = (min: number): Segment => ({ kind: "cooldown", seconds: min * 60, zone: [1, 2] });
function reps(n: number, workS: number, easyS: number, workZone: [number, number]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ kind: "work", seconds: workS, zone: workZone });
    if (i < n - 1) out.push({ kind: "easy", seconds: easyS, zone: [1, 2] });
  }
  return out;
}

export const ROW_SESSIONS: RowSession[] = [
  {
    key: "ROW_TEMPO",
    name: "Tempo 3 × 6",
    short: "3 × 6 min comfortably hard, 2 min easy",
    description: "Three 6-minute pieces in zone 3 (comfortably hard: you can say a few words), 2 minutes easy between.",
    workZone: [3, 3],
    firstTargetOffsetS: 10,
    segments: [warm(5), ...reps(3, 360, 120, [3, 3]), cool(3)],
  },
  {
    key: "ROW_1MIN",
    name: "1-minute intervals",
    short: "8 × 1 min hard, 1 min easy",
    description: "Eight 1-minute reps in zone 4 (hard, a word at a time), 1 minute easy between. Short enough to stay strong every rep.",
    workZone: [4, 4],
    firstTargetOffsetS: 20,
    segments: [warm(6), ...reps(8, 60, 60, [4, 4]), cool(4)],
  },
  {
    key: "ROW_4X4",
    name: "4 × 4",
    short: "4 × 4 min very hard, 3 min easy",
    description: "Four 4-minute pieces at 85–95% of your max heart rate, 3 minutes easy between. The best-studied way to raise fitness (VO₂max).",
    workZone: [4, 5],
    firstTargetOffsetS: 15,
    segments: [warm(8), ...reps(4, 240, 180, [4, 5]), cool(5)],
  },
];

export const getRowSession = (key: string | null | undefined) => ROW_SESSIONS.find((s) => s.key === key);
export const sessionSeconds = (s: RowSession) => s.segments.reduce((a, x) => a + x.seconds, 0);
export const workReps = (s: RowSession) => s.segments.filter((x) => x.kind === "work").length;

/** Where in the session the PM5 clock is: the part, its index, seconds left in it, and which hard rep. */
export function segmentAt(s: RowSession, elapsedS: number) {
  let t = 0;
  let rep = 0;
  for (let i = 0; i < s.segments.length; i++) {
    const seg = s.segments[i];
    if (seg.kind === "work") rep++;
    if (elapsedS < t + seg.seconds) return { seg, index: i, left: t + seg.seconds - elapsedS, rep, done: false };
    t += seg.seconds;
  }
  return { seg: s.segments[s.segments.length - 1], index: s.segments.length - 1, left: 0, rep, done: true };
}

/** Each hard rep of a guided row. */
export type RepStat = { rep: number; seconds: number; distanceM: number; splitS: number | null; avgSpm: number | null; avgWatts: number | null; maxHr: number | null; /** Heart rate at the end of the easy part after this rep (how fast it came down). */ hrAfterEasy: number | null };

/** What a guided row is aiming for. Stored on the rowing entry when the workout is built. */
export type RowPlan = { session: RowSessionKey; targetSplitS: number | null; note?: string };

/** Personal targets and zones the per-row Claude review keeps up to date (saved in the plan). */
export type RowCoaching = {
  targets: Partial<Record<RowSessionKey, { splitS: number; note: string; at: string }>>;
  fourByFourUnlocked: boolean;
  /** The highest heart rate seen on a hard rep, once it's above the age estimate. */
  measuredMaxHr: number | null;
  lastReview?: { workoutId: string; summary: string; at: string };
};

export const isHarderRow = (w: Workout) => !!getRowSession(w.templateKey);

/** Finished guided rows with their logged pieces, newest first. */
export function harderRows(history: Workout[]) {
  return history
    .filter((w) => w.finishedAt && isHarderRow(w))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((w) => ({ workout: w, piece: w.entries.flatMap((e) => e.sets.filter((s) => s.done && s.row).map((s) => s.row as RowPiece))[0] ?? null }));
}

/** Average split of recent easy rows, the base for first-time hard targets. */
export function easySplit(history: Workout[]): number | null {
  const splits = history
    .filter((w) => w.finishedAt && w.templateKey === "ROW")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((w) => w.entries.flatMap((e) => e.sets.map((s) => s.row?.avgSplitS ?? null)))
    .filter((x): x is number => x != null)
    .slice(0, 3);
  return splits.length ? splits.reduce((a, b) => a + b, 0) / splits.length : null;
}

/**
 * Target split for a session: Claude's latest target for it, else the last time's average hard
 * split, else the easy-row split minus the session's offset. Null when there's nothing to go on.
 */
export function targetSplit(key: RowSessionKey, history: Workout[], coaching?: RowCoaching | null): number | null {
  const set = coaching?.targets[key]?.splitS;
  if (set) return set;
  const last = harderRows(history).find((r) => r.workout.templateKey === key && r.piece?.reps?.length);
  const lastReps = last?.piece?.reps?.map((r) => r.splitS).filter((x): x is number => x != null) ?? [];
  if (lastReps.length) return Math.round((lastReps.reduce((a, b) => a + b, 0) / lastReps.length) * 10) / 10;
  const easy = easySplit(history);
  const s = getRowSession(key)!;
  return easy ? Math.round((easy - s.firstTargetOffsetS) * 10) / 10 : null;
}

/** Max heart rate for zones: the measured one once there is one, otherwise the age estimate. */
export function zonesMax(birthYear: number | null, coaching?: RowCoaching | null): number | null {
  const est = birthYear ? maxHeartRate(birthYear) : null;
  const measured = coaching?.measuredMaxHr ?? null;
  if (measured && (!est || measured > est)) return measured;
  return est;
}

/** 4 × 4 is offered after three harder rows, or earlier if the review says so. */
export function fourByFourUnlocked(history: Workout[], coaching?: RowCoaching | null): boolean {
  return !!coaching?.fourByFourUnlocked || harderRows(history).length >= 3;
}

/** Attach the guided session's plan to a new row workout's rowing entry. */
export function withRowPlan(w: Workout, history: Workout[], plan: Plan): Workout {
  const s = getRowSession(w.templateKey);
  if (!s) return w;
  const target = targetSplit(s.key, history, plan.rowCoaching);
  const note = plan.rowCoaching?.targets[s.key]?.note;
  const minutes = Math.round(sessionSeconds(s) / 60);
  return {
    ...w,
    entries: w.entries.map((e): Entry =>
      e.exerciseId === ROW_EXERCISE
        ? {
            ...e,
            rowPlan: { session: s.key, targetSplitS: target, ...(note ? { note } : {}) },
            hint: s.description,
            goalReps: minutes,
            sets: e.sets.map((x) => ({ ...x, reps: minutes })),
          }
        : e,
    ),
  };
}

/**
 * Readiness before a harder row, using the same "two signs must agree" rule as the weekly coach:
 * last night's sleep under 6.5 h, resting heart rate 5+ bpm above the previous weeks, HRV more
 * than 15% below its 7-day average. Returns the signs that are off; two or more suggests an easy row.
 */
export function readiness(days: { day: string; restingHr: number | null; hrvMs: number | null; sleepMin: number | null }[], today = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  const key = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const now = sorted.find((d) => d.day === key);
  const before = sorted.filter((d) => d.day < key);
  const avg = (v: (number | null)[]) => {
    const x = v.filter((n): n is number => n != null);
    return x.length >= 3 ? x.reduce((a, b) => a + b, 0) / x.length : null;
  };
  const signs: string[] = [];
  if (now?.sleepMin != null && now.sleepMin < 390) signs.push(`slept ${Math.floor(now.sleepMin / 60)} h ${Math.round(now.sleepMin % 60)} min`);
  const rhrBase = avg(before.slice(-21).map((d) => d.restingHr));
  const rhr = now?.restingHr ?? before.at(-1)?.restingHr ?? null;
  if (rhr != null && rhrBase != null && rhr >= rhrBase + 5) signs.push(`resting heart rate ${Math.round(rhr)} (usually ${Math.round(rhrBase)})`);
  const hrvBase = avg(before.slice(-7).map((d) => d.hrvMs));
  const hrv = now?.hrvMs ?? before.at(-1)?.hrvMs ?? null;
  if (hrv != null && hrvBase != null && hrv < hrvBase * 0.85) signs.push(`HRV ${Math.round(hrv)} ms (7-day average ${Math.round(hrvBase)})`);
  return { signs, suggestEasy: signs.length >= 2 };
}
