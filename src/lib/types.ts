export type Unit = "reps" | "seconds" | "minutes";

export type Target = {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
};

export type SetLog = {
  weight: number | null;
  reps: number | null;
  done: boolean;
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
  source: "manual" | "withings";
};

export type Sex = "male" | "female";

export type Profile = {
  heightCm: number;
  sex: Sex;
  birthYear: number;
};
