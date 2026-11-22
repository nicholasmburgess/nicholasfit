import { isAdjustable } from "./adjustable";
import { getExercise } from "./exercises";
import type { Entry, Workout } from "./types";

/**
 * Supersets: neighbouring exercises with the same `group` are done back to back (A1, B1, rest,
 * A2, B2, rest…). Saves time in a 45-minute session, best with exercises that don't compete,
 * like a press and a row.
 */

const members = (entries: Entry[], group: string) => entries.flatMap((e, i) => (e.group === group ? [i] : []));

/** The next set to do, following superset order. */
export function nextUp(w: Workout): { ei: number; si: number } | null {
  const ei = w.entries.findIndex((e) => e.sets.some((s) => !s.done));
  if (ei < 0) return null;
  const e = w.entries[ei];
  if (!e.group) return { ei, si: e.sets.findIndex((s) => !s.done) };
  // Within a superset, the member furthest behind goes next (the earlier one on a tie).
  let best: { ei: number; si: number } | null = null;
  for (const i of members(w.entries, e.group)) {
    const si = w.entries[i].sets.findIndex((s) => !s.done);
    if (si >= 0 && (!best || si < best.si)) best = { ei: i, si };
  }
  return best;
}

/** After ticking set `si` of entry `ei`: false while that superset round still has another exercise to do. */
export function restAfter(w: Workout, ei: number, si: number): boolean {
  const next = nextUp(w);
  const g = w.entries[ei]?.group;
  return !(g && next && next.ei !== ei && w.entries[next.ei].group === g && next.si === si);
}

/** Rest time after a set: a superset uses the longest rest of its exercises. */
export function restSeconds(w: Workout, ei: number): number {
  const e = w.entries[ei];
  if (!e.group) return e.target.restSec;
  return Math.max(...members(w.entries, e.group).map((i) => w.entries[i].target.restSec));
}

/** Why this exercise can't be paired with the next one, or null if it can. */
export function supersetBlocker(entries: Entry[], ei: number): string | null {
  const a = entries[ei], b = entries[ei + 1];
  if (!a || !b) return "Add another exercise after this one first";
  if (isAdjustable(a.exerciseId) && isAdjustable(b.exerciseId)) {
    const wa = a.sets.find((s) => !s.done)?.weight ?? a.sets[0]?.weight;
    const wb = b.sets.find((s) => !s.done)?.weight ?? b.sets[0]?.weight;
    const same = getExercise(a.exerciseId)?.load === getExercise(b.exerciseId)?.load && wa === wb;
    // One adjustable set: alternating two weights would mean re-loading every set.
    if (!same) return "Both use your one dumbbell/kettlebell set at different weights, so you'd re-load it every set";
  }
  return null;
}

/** Pair entry `ei` with the one after it (joining its superset if it has one). */
export function linkNext(entries: Entry[], ei: number): Entry[] {
  const g = entries[ei].group ?? entries[ei + 1]?.group ?? `ss${Date.now().toString(36)}`;
  return entries.map((e, i) => (i === ei || i === ei + 1 ? { ...e, group: g } : e));
}

/** Take entry `ei` out of its superset (a superset left with one exercise is dissolved). */
export function unlink(entries: Entry[], ei: number): Entry[] {
  const g = entries[ei].group;
  if (!g) return entries;
  const next = entries.map((e, i) => (i === ei ? { ...e, group: undefined } : e));
  const left = members(next, g);
  return left.length === 1 ? next.map((e, i) => (i === left[0] ? { ...e, group: undefined } : e)) : next;
}

/** Label for a superset member, e.g. "Superset with Seated Cable Row". */
export function supersetLabel(entries: Entry[], ei: number): string | null {
  const g = entries[ei].group;
  if (!g) return null;
  const others = members(entries, g).filter((i) => i !== ei).map((i) => getExercise(entries[i].exerciseId)?.name ?? entries[i].exerciseId);
  return others.length ? `Superset with ${others.join(" + ")}` : null;
}
