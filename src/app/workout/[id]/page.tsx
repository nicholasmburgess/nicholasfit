"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/Card";
import { ExercisePicker } from "@/components/ExercisePicker";
import { RestTimer } from "@/components/RestTimer";
import { SetRow } from "@/components/SetRow";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { getExercise, unitLabel, weightLabel } from "@/lib/exercises";
import { formatDate, formatDuration } from "@/lib/format";
import { buildEntry, exerciseHistory } from "@/lib/progression";
import { DEFAULT_TARGET } from "@/lib/routines";
import { store } from "@/lib/store";
import type { Entry, SetLog, Workout } from "@/lib/types";

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [history, setHistory] = useState<Workout[]>([]);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef<Workout | null>(null);

  useEffect(() => {
    (async () => {
      const [w, all] = await Promise.all([store.getWorkout(id), store.listWorkouts()]);
      setWorkout(w);
      setHistory(all.filter((x) => x.id !== id));
    })();
  }, [id]);

  latest.current = workout ?? null;

  async function flush() {
    const w = latest.current;
    if (!w || !dirty.current) return;
    dirty.current = false;
    try {
      await store.saveWorkout(w);
      setSaveError(null);
    } catch (e) {
      dirty.current = true;
      setSaveError(e instanceof Error ? e.message : "Could not save");
    }
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Save shortly after typing; ticks save straight away (see toggleDone).
  useEffect(() => {
    if (!workout || !dirty.current) return;
    const t = setTimeout(() => flushRef.current(), 400);
    return () => clearTimeout(t);
  }, [workout]);

  // Never lose the last change when leaving the page or the phone locks.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flushRef.current();
    const onPageHide = () => flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushRef.current();
    };
  }, []);

  // Keep the screen awake during an unfinished workout.
  const active = !!workout && !workout.finishedAt;
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Not allowed right now (e.g. low battery mode).
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);

  if (workout === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (workout === null)
    return (
      <p className="pt-10 text-center text-muted">
        Workout not found. <Link href="/" className="text-accent">Back to today</Link>
      </p>
    );

  const w = workout;
  const update = (fn: (w: Workout) => Workout) => {
    dirty.current = true;
    setWorkout((prev) => {
      const next = prev ? fn(prev) : prev;
      latest.current = next ?? null;
      return next;
    });
  };
  const updateEntry = (i: number, fn: (e: Entry) => Entry) =>
    update((w) => ({ ...w, entries: w.entries.map((e, j) => (j === i ? fn(e) : e)) }));

  function changeSet(ei: number, si: number, patch: Partial<SetLog>) {
    updateEntry(ei, (e) => {
      const sets = e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s));
      // Carry a changed weight forward to later sets that haven't been done yet.
      if (patch.weight !== undefined) {
        const old = e.sets[si].weight;
        for (let j = si + 1; j < sets.length; j++) if (!sets[j].done && sets[j].weight === old) sets[j] = { ...sets[j], weight: patch.weight };
      }
      return { ...e, sets };
    });
  }

  function toggleDone(ei: number, si: number) {
    const e = w.entries[ei];
    const s = e.sets[si];
    const done = !s.done;
    changeSet(ei, si, { done, reps: s.reps ?? e.goalReps ?? e.target.repMin });
    setTimeout(() => flushRef.current(), 0);
    if (done && e.target.restSec > 0) setRest({ endsAt: Date.now() + e.target.restSec * 1000, total: e.target.restSec });
  }

  async function finish() {
    const done = { ...w, finishedAt: new Date().toISOString() };
    dirty.current = false;
    await store.saveWorkout(done);
    router.push("/");
  }

  async function remove() {
    if (!confirm(w.finishedAt ? "Delete this workout from your history?" : "Discard this workout?")) return;
    dirty.current = false;
    await store.deleteWorkout(w.id);
    router.push("/");
  }

  const doneSets = w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  return (
    <main className="space-y-4">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">{w.name}</h1>
          <p className="text-sm text-muted">
            {formatDate(w.startedAt)}
            {w.finishedAt ? ` · ${formatDuration(w.startedAt, w.finishedAt)} · completed` : <Elapsed since={w.startedAt} />}
          </p>
        </div>
        {!w.finishedAt && (
          <Button onClick={finish} disabled={doneSets === 0}>
            Finish
          </Button>
        )}
      </header>

      {saveError && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">Not saved: {saveError}</p>}

      {w.entries.map((e, ei) => (
        <EntryCard
          key={`${e.exerciseId}-${ei}`}
          entry={e}
          last={exerciseHistory(history, e.exerciseId)[0]?.sets}
          onChangeSet={(si, patch) => changeSet(ei, si, patch)}
          onToggle={(si) => toggleDone(ei, si)}
          onAddSet={() => updateEntry(ei, (x) => ({ ...x, sets: [...x.sets, { weight: x.sets.at(-1)?.weight ?? null, reps: null, done: false }] }))}
          onRemoveSet={() => updateEntry(ei, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}
          onRemove={() => update((w) => ({ ...w, entries: w.entries.filter((_, j) => j !== ei) }))}
        />
      ))}

      <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>
      <Button variant="danger" className="w-full" onClick={remove}>
        {w.finishedAt ? "Delete workout" : "Discard workout"}
      </Button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => {
            setPicking(false);
            update((w) => ({ ...w, entries: [...w.entries, buildEntry(history, exerciseId, DEFAULT_TARGET)] }));
          }}
        />
      )}

      {rest && <div className="h-24" aria-hidden />}
      {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} onAdd={(s) => setRest({ ...rest, endsAt: rest.endsAt + s * 1000, total: rest.total + s })} onDone={() => setRest(null)} />}
    </main>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return <> · {Math.max(0, Math.floor((now - Date.parse(since)) / 60000))} min</>;
}

function EntryCard({
  entry,
  last,
  onChangeSet,
  onToggle,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  entry: Entry;
  last?: SetLog[];
  onChangeSet: (si: number, patch: Partial<SetLog>) => void;
  onToggle: (si: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const ex = getExercise(entry.exerciseId);
  const [showDemo, setShowDemo] = useState(false);
  if (!ex) return null;
  const { target } = entry;
  const unit = unitLabel(ex.unit);
  const wLabel = weightLabel(ex);
  const rest = target.restSec >= 60 ? `${Math.floor(target.restSec / 60)}:${String(target.restSec % 60).padStart(2, "0")}` : `${target.restSec}s`;

  return (
    <Card className="!p-0">
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/exercises/${ex.id}`} className="font-[Iowan_Old_Style,Palatino,Georgia,serif] text-lg font-semibold">
              {ex.name}
            </Link>
            <p className="text-sm text-muted">
              {target.sets} × {target.repMin}–{target.repMax} {unit}
              {target.restSec > 0 && ` · rest ${rest}`}
            </p>
          </div>
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted" onClick={() => setShowDemo((s) => !s)}>
            {showDemo ? "Hide demo" : "How to"}
          </button>
        </div>
        {entry.hint && <p className="mt-2 text-sm text-accent">{entry.hint}</p>}
        {last && (
          <p className="mt-1 text-xs text-muted">
            Last time: {last.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`)).join(", ")}
          </p>
        )}
        {showDemo && (
          <div className="mt-3 space-y-2">
            <ExerciseDemo images={ex.images} name={ex.name} />
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ex.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="text-xs text-muted">Avoid: {ex.mistakes.join("; ").toLowerCase()}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 px-4 pb-1 text-xs text-muted">
        <span>Set</span>
        <span>{wLabel || " "}</span>
        <span>{unit}</span>
        <span />
      </div>
      <div className="space-y-1.5 px-4 pb-3">
        {entry.sets.map((s, si) => (
          <SetRow
            key={si}
            index={si}
            set={s}
            showWeight={!!wLabel}
            repsPlaceholder={entry.goalReps ? String(entry.goalReps) : `${target.repMin}–${target.repMax}`}
            onChange={(patch) => onChangeSet(si, patch)}
            onToggle={() => onToggle(si)}
          />
        ))}
      </div>
      <div className="flex border-t border-line text-sm">
        <button className="flex-1 py-2.5 text-accent" onClick={onAddSet}>
          + Set
        </button>
        <button className="flex-1 py-2.5 text-muted disabled:opacity-40" onClick={onRemoveSet} disabled={entry.sets.length <= 1}>
          − Set
        </button>
        <button className="flex-1 py-2.5 text-muted" onClick={onRemove}>
          Remove
        </button>
      </div>
    </Card>
  );
}
