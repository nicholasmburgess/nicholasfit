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
