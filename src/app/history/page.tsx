"use client";

import Link from "next/link";
import { formatDate, formatDuration } from "@/lib/format";
import { workoutSummary } from "@/lib/progression";
import { useWorkouts } from "@/lib/useWorkouts";
import { weightsCsv, workoutsCsv } from "@/lib/export";
import { foodStore } from "@/lib/food-store";
import { isNativeApp, postNative } from "@/lib/native";

/** Save a CSV: the iPhone app opens the share sheet (Files, Mail, AirDrop); a browser downloads it. */
function saveCsv(name: string, text: string) {
  if (isNativeApp()) return postNative({ type: "shareFile", name, mime: "text/csv", text });
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
    <main className="space-y-4 md:mx-auto md:max-w-3xl">
      <h1 className="pt-2 text-2xl font-bold">History</h1>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {finished.length === 0 && <p className="text-sm text-muted">Finished workouts will show up here.</p>}
      {finished.length > 0 && (
        <div className="flex gap-2">
          <button className="flex-1 rounded-xl border border-line bg-card py-2.5 text-sm font-medium" onClick={() => saveCsv(`nicholasfit-workouts-${new Date().toISOString().slice(0, 10)}.csv`, workoutsCsv(workouts))}>
            Export workouts (CSV)
          </button>
          <button
            className="flex-1 rounded-xl border border-line bg-card py-2.5 text-sm font-medium"
            onClick={async () => saveCsv(`nicholasfit-body-weight-${new Date().toISOString().slice(0, 10)}.csv`, weightsCsv(await foodStore.listWeights().catch(() => [])))}
          >
            Export body weight (CSV)
          </button>
        </div>
      )}
      {[...groups].map(([month, ws]) => (
        <section key={month}>
          <h2 className="mb-2 text-sm font-semibold text-muted">
            {month} · {ws.length} {ws.length === 1 ? "workout" : "workouts"}
          </h2>
          <ul className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
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
                    {workoutSummary(w)[0]}
                    <br />
                    {workoutSummary(w)[1]}
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
