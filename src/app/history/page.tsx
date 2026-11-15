"use client";

import Link from "next/link";
import { formatDate, formatDuration, formatKg } from "@/lib/format";
import { doneSetCount, volumeKg } from "@/lib/progression";
import { useWorkouts } from "@/lib/useWorkouts";

export default function HistoryPage() {
  const { workouts, error } = useWorkouts();
  if (!workouts) return <p className="pt-10 text-center text-muted">Loading…</p>;
  const finished = workouts.filter((w) => w.finishedAt);

  // Group by month.
  const groups = new Map<string, typeof finished>();
  for (const w of finished) {
    const k = new Date(w.startedAt).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }

  return (
    <main className="space-y-4">
      <h1 className="pt-2 text-2xl font-bold">History</h1>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {finished.length === 0 && <p className="text-sm text-muted">Finished workouts will show up here.</p>}
      {[...groups].map(([month, ws]) => (
        <section key={month}>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            {month} · {ws.length} {ws.length === 1 ? "workout" : "workouts"}
          </h2>
          <ul className="space-y-2">
            {ws.map((w) => (
              <li key={w.id}>
                <Link href={`/workout/${w.id}`} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3">
                  <span>
                    <span className="block font-medium">{w.name}</span>
                    <span className="text-sm text-muted">
                      {formatDate(w.startedAt)} · {formatDuration(w.startedAt, w.finishedAt)}
                    </span>
                  </span>
                  <span className="text-right text-sm text-muted">
                    {doneSetCount(w)} sets
                    <br />
                    {formatKg(volumeKg(w))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
