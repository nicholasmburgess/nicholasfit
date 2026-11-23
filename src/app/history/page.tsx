import { redirect } from "next/navigation";

/** History moved into the Workout tab. */
export default function HistoryPage() {
  redirect("/workouts");
}
