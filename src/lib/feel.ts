import type { Feel } from "./types";

/**
 * Set ratings, each tied to reps in reserve (RIR): how many more reps you could have done.
 * Fixed bands make the ratings consistent, and the 2-rep width allows for beginners tending to
 * misjudge reps left by about a rep (Halperin 2022). Most sets should land on Good.
 */
export const FEELS: { value: Feel; label: string; reps: string }[] = [
  { value: "easy", label: "Easy", reps: "4+ left" },
  { value: "good", label: "Good", reps: "2–3 left" },
  { value: "hard", label: "Hard", reps: "0–1 left" },
];
