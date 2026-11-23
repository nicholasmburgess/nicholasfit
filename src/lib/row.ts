import type { RowPiece, Workout } from "./types";

/** 145.3 s -> "2:25.3" (pace per 500 m, as the PM5 shows it). */
export function formatSplit(s: number | null | undefined, tenths = true): string {
  if (s == null || !Number.isFinite(s) || s <= 0 || s > 3600) return "–:––";
  const total = tenths ? Math.round(s * 10) / 10 : Math.round(s);
  const m = Math.floor(total / 60);
  const rest = total - m * 60;
  const sec = tenths ? rest.toFixed(1).padStart(4, "0") : String(Math.round(rest)).padStart(2, "0");
  return `${m}:${sec}`;
}

/** 1265 s -> "21:05", 3725 s -> "1:02:05". */
export function formatClock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const formatMetres = (m: number) => `${Math.round(m).toLocaleString("en-AU")} m`;

/** One line for a logged row, e.g. "5,012 m · 21:05 · 2:06 /500m · 22 spm · 180 W". */
export function rowLine(r: RowPiece): string {
  return [
    formatMetres(r.distanceM),
    formatClock(r.seconds),
    r.avgSplitS ? `${formatSplit(r.avgSplitS, false)} /500m` : null,
    r.avgSpm ? `${Math.round(r.avgSpm)} spm` : null,
    r.avgWatts ? `${Math.round(r.avgWatts)} W` : null,
    r.avgHr ? `${r.avgHr} bpm avg` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Every PM5 row ticked in a workout. */
export function workoutRows(w: Workout): RowPiece[] {
  return w.entries.flatMap((e) => e.sets.filter((s) => s.done && s.row).map((s) => s.row as RowPiece));
}

/**
 * Active calories for Apple Health. Concept2's calorie formula is 4 × watts × 0.8604 + 300 per hour,
 * where the 300 kcal/h is a resting allowance, so it's removed to leave the energy the row itself used.
 */
export function activeKcal(r: RowPiece): number | null {
  if (r.kcal == null) return null;
  return Math.max(0, Math.round(r.kcal - (300 * r.seconds) / 3600));
}

/** The Concept2 rower in the exercise list. */
export const ROW_EXERCISE = "Rowing_Stationary";
