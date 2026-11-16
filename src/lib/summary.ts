import { getExercise } from "./exercises";
import { volumeKg } from "./progression";
import type { Workout } from "./types";

export type Highlight = { exerciseId: string; text: string };

/** Personal records in this workout compared with all earlier finished workouts. */
export function personalRecords(w: Workout, history: Workout[]): Highlight[] {
  const earlier = history.filter((h) => h.finishedAt && h.id !== w.id && h.startedAt < w.startedAt);
  const out: Highlight[] = [];
  for (const e of w.entries) {
    const ex = getExercise(e.exerciseId);
    if (!ex) continue;
    const done = e.sets.filter((s) => s.done && s.reps != null);
    if (!done.length) continue;
    const past = earlier.flatMap((h) => h.entries.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets.filter((s) => s.done && s.reps != null)));
    if (!past.length) continue; // first time: nothing to beat yet
    if (ex.unit === "reps" && done.some((s) => (s.weight ?? 0) > 0)) {
      const best = Math.max(...done.map((s) => s.weight ?? 0));
      const pastBest = Math.max(...past.map((s) => s.weight ?? 0));
      if (best > pastBest) {
        out.push({ exerciseId: e.exerciseId, text: `${ex.name}: new heaviest, ${best} kg` });
        continue;
      }
      const repsAt = Math.max(...done.filter((s) => s.weight === best).map((s) => s.reps ?? 0));
      const pastRepsAt = Math.max(0, ...past.filter((s) => s.weight === best).map((s) => s.reps ?? 0));
      if (repsAt > pastRepsAt) out.push({ exerciseId: e.exerciseId, text: `${ex.name}: most reps at ${best} kg (${repsAt})` });
    } else {
      const best = Math.max(...done.map((s) => s.reps ?? 0));
      const pastBest = Math.max(...past.map((s) => s.reps ?? 0));
      if (best > pastBest) out.push({ exerciseId: e.exerciseId, text: `${ex.name}: new best, ${best} ${ex.unit === "seconds" ? "sec" : ex.unit === "minutes" ? "min" : "reps"}` });
    }
  }
  return out;
}

/** The last finished session of the same routine before this one. */
export function previousSameRoutine(w: Workout, history: Workout[]): Workout | undefined {
  if (!w.templateKey) return undefined;
  return history
    .filter((h) => h.finishedAt && h.id !== w.id && h.templateKey === w.templateKey && h.startedAt < w.startedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

export function volumeChange(w: Workout, history: Workout[]): number | null {
  const prev = previousSameRoutine(w, history);
  if (!prev) return null;
  const a = volumeKg(prev);
  if (a <= 0) return null;
  return Math.round(((volumeKg(w) - a) / a) * 100);
}
