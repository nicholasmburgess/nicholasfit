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
