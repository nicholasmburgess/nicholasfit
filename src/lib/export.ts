import { getExercise } from "./exercises";
import { e1rm } from "./records";
import type { WeightEntry, Workout } from "./types";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";

/** One row per logged set, in the same shape as Strong/Hevy exports so it opens anywhere. */
export function workoutsCsv(workouts: Workout[]): string {
  const rows: unknown[][] = [["Date", "Workout", "Duration (min)", "Exercise", "Set", "Weight (kg)", "Reps/Time", "Unit", "Done", "Feel", "Est. 1RM (kg)", "Superset", "Note"]];
  for (const w of [...workouts].filter((x) => x.finishedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const mins = Math.round((Date.parse(w.finishedAt!) - Date.parse(w.startedAt)) / 60000);
    for (const e of w.entries) {
      const ex = getExercise(e.exerciseId);
      e.sets.forEach((s, i) =>
        rows.push([w.startedAt, w.name, mins, ex?.name ?? e.exerciseId, i + 1, s.weight, s.reps, ex?.unit ?? "reps", s.done ? "yes" : "no", s.feel, e1rm(s.weight, s.reps) || "", e.group ? "yes" : "", i === 0 ? e.note : ""]),
      );
    }
  }
  return toCsv(rows);
}

export function weightsCsv(weights: WeightEntry[]): string {
  return toCsv([["Date", "Weight (kg)", "Body fat (%)", "Source"], ...weights.map((w) => [w.measuredAt, w.kg, w.fatPct, w.source])]);
}
