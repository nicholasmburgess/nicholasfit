import { getExercise } from "./exercises";
import type { Entry } from "./types";

/**
 * Nicholas has one adjustable Ironmaster set that works as dumbbells or a kettlebell,
 * so each new weight (or switching between dumbbell and kettlebell) means re-loading it.
 * A workout should need at most two set-ups: the first one plus one change.
 */
export const MAX_ADJUSTABLE_SETUPS = 2;

export type Setup = { load: "dumbbell" | "kettlebell"; weight: number | null; exerciseId: string };

export function isAdjustable(exerciseId: string): boolean {
  const load = getExercise(exerciseId)?.load;
  return load === "dumbbell" || load === "kettlebell";
}

/** Each time the adjustable set has to be re-loaded, in workout order. */
export function adjustableSetups(entries: Entry[]): Setup[] {
  const out: Setup[] = [];
  for (const e of entries) {
    if (!isAdjustable(e.exerciseId)) continue;
    const load = getExercise(e.exerciseId)!.load as Setup["load"];
    for (const s of e.sets) {
      const last = out.at(-1);
      // A set with no weight yet still needs the set loaded, unless it follows the same exercise.
      const same = last && last.load === load && (s.weight == null ? last.exerciseId === e.exerciseId : last.weight === s.weight);
      if (!same) out.push({ load, weight: s.weight, exerciseId: e.exerciseId });
      else if (last && last.weight == null && s.weight != null) last.weight = s.weight;
    }
  }
  return out;
}

/**
 * Best weight for an adjustable exercise placed at `index` (replacing that entry when `replace`),
 * chosen from weights already loaded in this workout so it adds as few re-loads as possible.
 */
export function planAdjustable(
  entries: Entry[],
  candidate: Entry,
  index: number,
  replace: boolean,
): { weight: number | null; setups: number } {
  const place = (e: Entry) => {
    const copy = [...entries];
    copy.splice(index, replace ? 1 : 0, e);
    return copy;
  };
  const withWeight = (w: number | null): Entry => ({ ...candidate, sets: candidate.sets.map((s) => ({ ...s, weight: w })) });
  if (!isAdjustable(candidate.exerciseId)) return { weight: candidate.sets[0]?.weight ?? null, setups: adjustableSetups(place(candidate)).length };

  const load = getExercise(candidate.exerciseId)?.load;
  const others = replace ? entries.filter((_, i) => i !== index) : entries;
  const options = [...new Set(adjustableSetups(others).filter((s) => s.load === load && s.weight != null).map((s) => s.weight as number))];
  let best = { weight: candidate.sets[0]?.weight ?? null, setups: adjustableSetups(place(candidate)).length };
  for (const w of options) {
    const n = adjustableSetups(place(withWeight(w))).length;
    if (n < best.setups) best = { weight: w, setups: n };
  }
  return best;
}

/** Adjust weights of later adjustable exercises so a new workout stays within the limit. */
export function fitAdjustable(entries: Entry[]): Entry[] {
  const out: Entry[] = [];
  for (const e of entries) {
    const next = [...out, e];
    if (isAdjustable(e.exerciseId) && adjustableSetups(next).length > MAX_ADJUSTABLE_SETUPS) {
      const plan = planAdjustable(out, e, out.length, false);
      if (plan.weight != null && plan.weight !== e.sets[0]?.weight) {
        out.push({
          ...e,
          sets: e.sets.map((s) => ({ ...s, weight: plan.weight })),
          hint: `${plan.weight} kg to match your loaded ${getExercise(e.exerciseId)?.load}s (saves a weight change)`,
        });
        continue;
      }
    }
    out.push(e);
  }
  return out;
}
