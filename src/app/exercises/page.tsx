import { redirect } from "next/navigation";

/** The Exercises tab was removed: demos live in the workout, lift history in Progress. */
export default function ExercisesPage() {
  redirect("/progress");
}
