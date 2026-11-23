export type Unit = "reps" | "seconds" | "minutes";

export type Target = {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
};

export type Feel = "easy" | "good" | "hard";

export type SetLog = {
  weight: number | null;
  reps: number | null;
  done: boolean;
  /** How the set felt, tapped after ticking it. Drives the next set's weight and next session's jump. */
  feel?: Feel;
  /** A row logged live from the Concept2 PM5 over Bluetooth (one piece per set). */
  row?: RowPiece;
};

/** Totals for one piece rowed on the Concept2, read live from the PM5 monitor. */
export type RowPiece = {
  startedAt: string;
  seconds: number;
  distanceM: number;
  /** Average pace, seconds per 500 m. */
  avgSplitS: number | null;
  avgSpm: number | null;
  avgWatts: number | null;
  /** Calories as the PM5 shows them (Concept2's formula, includes about 300 kcal/h resting). */
  kcal: number | null;
  strokes: number | null;
  avgHr: number | null;
  maxHr: number | null;
  source: "pm5";
  /** Guided rows: the session and how each hard rep went. */
  session?: import("./row-sessions").RowSessionKey;
  reps?: import("./row-sessions").RepStat[];
  targetSplitS?: number | null;
};

export type Entry = {
  exerciseId: string;
  target: Target;
  sets: SetLog[];
  /** Suggestion shown when the workout was created, e.g. "Add 2.5 kg". */
  hint?: string;
  /** Reps to aim for this session; used when a set is ticked without typing reps. */
  goalReps?: number;
  /** The routine's original exercise when this one was swapped in, e.g. Goblet_Squat for Barbell_Squat. */
  slot?: string;
  /** Entries sharing a group id are a superset: alternate between them, rest after each round. */
  group?: string;
  /** Your own note for this exercise (e.g. "seat on notch 4"). Carried into future sessions. */
  note?: string;
  /** A guided row (tempo or intervals): which session and the target split for the hard parts. */
  rowPlan?: import("./row-sessions").RowPlan;
};

export type Workout = {
  id: string;
  name: string;
  templateKey: string | null;
  startedAt: string;
  finishedAt: string | null;
  entries: Entry[];
  notes: string;
};

export type MealItem = {
  name: string;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Meal = {
  id: string;
  eatenAt: string;
  description: string;
  items: MealItem[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** How sure the estimate is: low, medium or high. */
  confidence: string | null;
};

export type WeightEntry = {
  id: string;
  measuredAt: string;
  kg: number;
  /** Body fat percentage, when the scale measures it. */
  fatPct?: number | null;
  source: "manual" | "withings";
};

export type Sex = "male" | "female";

export type Profile = {
  heightCm: number;
  sex: Sex;
  birthYear: number;
};

export type Measurement = {
  id: string;
  measuredAt: string;
  kind: "waist";
  cm: number;
};
