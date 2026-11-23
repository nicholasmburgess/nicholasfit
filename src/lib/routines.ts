import type { Target } from "./types";

export type RoutineItem = { exerciseId: string; target: Target };
export type Routine = { key: string; name: string; summary: string; items: RoutineItem[] };

const t = (sets: number, repMin: number, repMax: number, restSec: number): Target => ({ sets, repMin, repMax, restSec });

/** Beginner full-body A/B routine, 3 days a week, about 45 minutes. */
export const ROUTINES: Routine[] = [
  {
    key: "A",
    name: "Strength A",
    summary: "Squat, bench, row, RDL, plank",
    items: [
      { exerciseId: "Goblet_Squat", target: t(3, 8, 12, 120) },
      { exerciseId: "Barbell_Bench_Press_-_Medium_Grip", target: t(3, 8, 10, 120) },
      { exerciseId: "Seated_Cable_Rows", target: t(3, 10, 12, 90) },
      { exerciseId: "Romanian_Deadlift", target: t(3, 10, 12, 90) },
      { exerciseId: "Plank", target: t(3, 30, 45, 60) },
    ],
  },
  {
    key: "B",
    name: "Strength B",
    summary: "Deadlift, shoulder press, pulldown, split squat, face pull",
    items: [
      { exerciseId: "Barbell_Deadlift", target: t(3, 6, 8, 150) },
      { exerciseId: "Dumbbell_Shoulder_Press", target: t(3, 8, 12, 90) },
      { exerciseId: "Wide-Grip_Lat_Pulldown", target: t(3, 10, 12, 90) },
      { exerciseId: "Split_Squat_with_Dumbbells", target: t(3, 8, 10, 90) },
      { exerciseId: "Face_Pull", target: t(3, 12, 15, 60) },
    ],
  },
  {
    key: "ROW",
    name: "Easy row",
    summary: "Optional: Concept2 at conversational pace",
    items: [{ exerciseId: "Rowing_Stationary", target: t(1, 20, 30, 0) }],
  },
  // Guided harder rows (see row-sessions.ts). One a week, on a day without lifting.
  {
    key: "ROW_TEMPO",
    name: "Tempo row 3 × 6",
    summary: "Concept2: 3 × 6 min comfortably hard, 2 min easy",
    items: [{ exerciseId: "Rowing_Stationary", target: t(1, 26, 26, 0) }],
  },
  {
    key: "ROW_1MIN",
    name: "Row intervals 8 × 1",
    summary: "Concept2: 8 × 1 min hard, 1 min easy",
    items: [{ exerciseId: "Rowing_Stationary", target: t(1, 25, 25, 0) }],
  },
  {
    key: "ROW_4X4",
    name: "Row 4 × 4",
    summary: "Concept2: 4 × 4 min very hard, 3 min easy",
    items: [{ exerciseId: "Rowing_Stationary", target: t(1, 38, 38, 0) }],
  },
];

export function getRoutine(key: string): Routine | undefined {
  return ROUTINES.find((r) => r.key === key);
}

export const DEFAULT_TARGET: Target = t(3, 8, 12, 90);
