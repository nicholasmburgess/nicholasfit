import type { Workout } from "./types";

/** A workout with no set ticked for this long was probably left open by mistake. */
export const STALE_HOURS = 3;
/** Time allowed after the last ticked set for a final set and packing up. */
const WRAP_UP_MS = 10 * 60e3;

/**
 * A workout left open (Finish never tapped) with at least one set done, finished at the time of the
 * last ticked set plus 10 minutes, so its sets count towards next weights, the A/B order and the weekly
 * review, and Apple Health doesn't get a 14-hour workout. Returns null when it should stay open.
 * Sets logged before set times were recorded fall back to an hour after the start.
 */
export function staleFinish(w: Workout, now = new Date()): Workout | null {
  if (w.finishedAt) return null;
  const sets = w.entries.flatMap((e) => e.sets.filter((s) => s.done));
  if (!sets.length) return null;
  const start = Date.parse(w.startedAt);
  const stamps = sets.map((s) => (s.doneAt ? Date.parse(s.doneAt) : NaN)).filter((t) => !Number.isNaN(t));
  const last = stamps.length ? Math.max(...stamps) : start + 50 * 60e3;
  if (now.getTime() - Math.max(last, start) < STALE_HOURS * 3600e3) return null;
  return { ...w, finishedAt: new Date(Math.max(last, start) + WRAP_UP_MS).toISOString() };
}
