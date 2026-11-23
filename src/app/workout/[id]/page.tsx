"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/Card";
import { ExercisePicker } from "@/components/ExercisePicker";
import { RestTimer } from "@/components/RestTimer";
import { SetRow } from "@/components/SetRow";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { NumberSheet } from "@/components/NumberSheet";
import { WorkoutSummary } from "@/components/WorkoutSummary";
import { WORKOUT_EVENT } from "@/components/NativeBridge";
import { describePlates, warmupSets } from "@/lib/plates";
import { MAX_ADJUSTABLE_SETUPS, adjustableSetups, isAdjustable, planAdjustable } from "@/lib/adjustable";
import { getExercise, unitLabel, weightLabel } from "@/lib/exercises";
import { formatDate, formatDuration } from "@/lib/format";
import { applyFeel, buildEntry, exerciseHistory } from "@/lib/progression";
import { bests, isLivePr } from "@/lib/records";
import { linkNext, nextUp, restAfter, restSeconds, supersetBlocker, supersetLabel, unlink } from "@/lib/superset";
import { DEFAULT_TARGET } from "@/lib/routines";
import { hasNativeWorkout, openOnPhone, postNative, useHeartRate } from "@/lib/native";
import { store } from "@/lib/store";
import { SYNC_EVENT, pendingSync } from "@/lib/store/synced";
import type { Entry, Feel, SetLog, Workout } from "@/lib/types";

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [history, setHistory] = useState<Workout[]>([]);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ ei: number; si: number; field: "weight" | "reps"; thenComplete?: boolean } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const justFinished = useSearchParams().get("done") === "1";
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

  // The iPhone app's workout screen handed this workout back: show its sets.
  useEffect(() => {
    const on = (e: Event) => {
      const fresh = (e as CustomEvent<Workout>).detail;
      if (fresh.id !== id) return;
      dirty.current = false;
      latest.current = fresh;
      setWorkout(fresh);
    };
    window.addEventListener(WORKOUT_EVENT, on);
    return () => window.removeEventListener(WORKOUT_EVENT, on);
  }, [id]);

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
  const hr = useHeartRate(active);
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

  function toggleDone(ei: number, si: number, weight?: number) {
    const e = w.entries[ei];
    const s = e.sets[si];
    const done = !s.done;
    const ex = getExercise(e.exerciseId);
    // A loaded exercise ticked without a weight can't progress next time, so ask for the weight first.
    if (done && weight === undefined && s.weight == null && ex && weightLabel(ex)) {
      setEditing({ ei, si, field: "weight", thenComplete: true });
      return;
    }
    changeSet(ei, si, { done, reps: s.reps ?? e.goalReps ?? e.target.repMin, ...(weight !== undefined ? { weight } : {}), ...(done ? {} : { feel: undefined }) });
    setTimeout(() => flushRef.current(), 0);
    if (!done) return;
    // In a superset, go straight to the partner exercise and rest after the round.
    const after = { ...w, entries: w.entries.map((x, j) => (j === ei ? { ...x, sets: x.sets.map((st, k) => (k === si ? { ...st, done: true } : st)) } : x)) };
    const sec = restSeconds(after, ei);
    if (!restAfter(after, ei, si)) setRest(null);
    else if (sec > 0) setRest({ endsAt: Date.now() + sec * 1000, total: sec });
  }

  /** Build an entry for a new or swapped exercise, matching loaded dumbbell/kettlebell weights where possible. */
  function placeEntry(exerciseId: string, target: Entry["target"], index: number, replace: boolean, slot?: string): Entry | null {
    const entry = buildEntry(history, exerciseId, target, slot);
    if (!isAdjustable(exerciseId)) return entry;
    const own = planAdjustable(w.entries, entry, index, replace);
    const ownSetups = adjustableSetups((() => { const c = [...w.entries]; c.splice(index, replace ? 1 : 0, entry); return c; })()).length;
    let result = entry;
    if (ownSetups > MAX_ADJUSTABLE_SETUPS && own.weight != null && own.setups < ownSetups) {
      result = { ...entry, sets: entry.sets.map((x) => ({ ...x, weight: own.weight })), hint: `${own.weight} kg to match your loaded ${getExercise(exerciseId)?.load}s (saves a weight change)` };
    }
    if (Math.min(own.setups, ownSetups) > MAX_ADJUSTABLE_SETUPS && !confirm("This needs a third dumbbell/kettlebell weight change. Add it anyway?")) return null;
    return result;
  }

  function pickerNote(index: number, replace: boolean) {
    return (id: string) => {
      if (!isAdjustable(id)) return undefined;
      const probe = buildEntry(history, id, DEFAULT_TARGET);
      return planAdjustable(w.entries, probe, index, replace).setups > MAX_ADJUSTABLE_SETUPS ? "Needs a 3rd weight change" : undefined;
    };
  }

  async function finish() {
    const unticked = w.entries.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    if (unticked > 0 && !confirm(`${unticked} ${unticked === 1 ? "set isn't" : "sets aren't"} ticked and won't count. Finish anyway?`)) return;
    const done = { ...w, finishedAt: new Date().toISOString() };
    dirty.current = false;
    latest.current = done;
    setWorkout(done);
    setRest(null);
    await store.saveWorkout(done);
    postNative({ type: "workoutFinished", id: done.id, name: done.name, startedAt: done.startedAt, finishedAt: done.finishedAt! });
    router.replace(`/workout/${w.id}?done=1`);
    window.scrollTo(0, 0);
  }

  async function remove() {
    if (!confirm(w.finishedAt ? "Delete this workout from your history?" : "Discard this workout?")) return;
    dirty.current = false;
    await store.deleteWorkout(w.id);
    if (!w.finishedAt) postNative({ type: "hrStop" });
    router.push("/");
  }

  const doneSets = w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const readOnly = !!w.finishedAt && !editMode;
  const setups = adjustableSetups(w.entries);
  const editingEntry = editing ? w.entries[editing.ei] : null;
  const editingEx = editingEntry ? getExercise(editingEntry.exerciseId) : undefined;

  return (
    <main className="space-y-4 md:mx-auto md:max-w-2xl">
      <header className="sticky top-0 z-10 -mx-4 flex items-start justify-between gap-3 border-b border-line bg-bg/95 px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <div>
          <h1 className="text-2xl font-bold">{w.name}</h1>
          <p className="text-sm text-muted">
            {formatDate(w.startedAt)}
            {w.finishedAt ? ` · ${formatDuration(w.startedAt, w.finishedAt)} · completed` : <Elapsed since={w.startedAt} />}
          </p>
          {hr && <HeartRateChip hr={hr} />}
        </div>
        {!w.finishedAt ? (
          <Button onClick={finish} disabled={doneSets === 0}>
            Finish
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setEditMode((m) => !m)}>
            {editMode ? "Done" : "Edit"}
          </Button>
        )}
      </header>

      {!w.finishedAt && hasNativeWorkout() && (
        <Button
          className="w-full"
          onClick={async () => {
            await flushRef.current();
            dirty.current = false;
            await openOnPhone(latest.current ?? w);
          }}
        >
          Back to workout screen
        </Button>
      )}

      {setups.length > 0 && !readOnly && (
        <p className={`-mt-2 text-xs ${setups.length > MAX_ADJUSTABLE_SETUPS ? "text-warn" : "text-muted"}`}>
          Dumbbell/kettlebell set-ups: {setups.length} of {MAX_ADJUSTABLE_SETUPS}
          {setups.length > MAX_ADJUSTABLE_SETUPS ? " · over your limit" : ""}
          {" · "}
          {setups.map((x) => (x.weight != null ? `${x.weight} kg ${x.load}` : `${x.load} (weight not set)`)).join(", then ")}
        </p>
      )}

      {justFinished && w.finishedAt && !editMode && <WorkoutSummary workout={w} history={history} />}

      {saveError && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">Not saved: {saveError}</p>}
      <SyncNote />

      {w.entries.map((e, ei) => (
        <EntryCard
          key={`${e.exerciseId}-${ei}`}
          entry={e}
          last={exerciseHistory(history, e.exerciseId)[0]?.sets}
          nextSi={nextUp(w)?.ei === ei ? nextUp(w)!.si : -1}
          superset={supersetLabel(w.entries, ei)}
          past={bests(history, e.exerciseId, w.id)}
          onNote={(note) => updateEntry(ei, (x) => ({ ...x, note: note.trim() }))}
          onSuperset={() => {
            if (w.entries[ei].group) return update((x) => ({ ...x, entries: unlink(x.entries, ei) }));
            const why = supersetBlocker(w.entries, ei);
            if (why) return alert(why);
            update((x) => ({ ...x, entries: linkNext(x.entries, ei) }));
          }}
          readOnly={readOnly}
          onEdit={(si, field) => setEditing({ ei, si, field })}
          onToggle={(si) => toggleDone(ei, si)}
          onFeel={(si, f) => {
            updateEntry(ei, (x) => applyFeel(x, si, f));
            setTimeout(() => flushRef.current(), 0);
          }}
          onSwap={() => setSwapping(ei)}
          onAddSet={() => updateEntry(ei, (x) => ({ ...x, sets: [...x.sets, { weight: x.sets.at(-1)?.weight ?? null, reps: null, done: false }] }))}
          onRemoveSet={() => updateEntry(ei, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}
          onRemove={() => update((w) => ({ ...w, entries: unlink(w.entries, ei).filter((_, j) => j !== ei) }))}
        />
      ))}

      {!readOnly && (
        <>
          <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
            + Add exercise
          </Button>
          <Button variant="danger" className="w-full" onClick={remove}>
            {w.finishedAt ? "Delete workout" : "Discard workout"}
          </Button>
        </>
      )}

      {swapping !== null && (
        <ExercisePicker
          title={`Swap ${getExercise(w.entries[swapping].exerciseId)?.name ?? "exercise"} for:`}
          prefer={getExercise(w.entries[swapping].exerciseId)?.pattern}
          onClose={() => setSwapping(null)}
          note={pickerNote(swapping, true)}
          onPick={(exerciseId) => {
            const ei = swapping;
            const old = w.entries[ei];
            const entry = placeEntry(exerciseId, old.target, ei, true, old.slot ?? old.exerciseId);
            if (!entry) return;
            setSwapping(null);
            updateEntry(ei, () => entry);
          }}
        />
      )}

      {editing && editingEntry && editingEx && (
        <NumberSheet
          key={`${editing.ei}-${editing.si}-${editing.field}`}
          title={editing.thenComplete ? `What weight did you use? (${editingEx.name})` : `${editingEx.name} · set ${editing.si + 1} · ${editing.field === "weight" ? "weight" : unitLabel(editingEx.unit)}`}
          unit={editing.field === "weight" ? weightLabel(editingEx) : unitLabel(editingEx.unit)}
          initial={
            editing.field === "weight"
              ? (editingEntry.sets[editing.si].weight ?? editingEntry.sets.findLast((x) => x.weight != null)?.weight ?? (editingEx.load === "barbell" ? 20 : 0))
              : (editingEntry.sets[editing.si].reps ?? editingEntry.goalReps ?? editingEntry.target.repMin)
          }
          step={editing.field === "weight" ? (editingEx.load === "barbell" || editingEx.load === "cable" ? 2.5 : 1) : editingEx.unit === "seconds" ? 5 : 1}
          bigStep={editing.field === "weight" ? (editingEx.load === "barbell" ? 10 : 5) : undefined}
          decimals={editing.field === "weight"}
          presets={
            editing.field === "weight" && isAdjustable(editingEntry.exerciseId)
              ? [...new Map(adjustableSetups(w.entries.filter((_, i) => i !== editing.ei)).filter((x) => x.load === editingEx.load && x.weight != null).map((x) => [x.weight, x])).values()].map((x) => ({
                  label: `Match ${x.weight} kg (${getExercise(x.exerciseId)?.name})`,
                  value: x.weight as number,
                }))
              : undefined
          }
          onClose={() => setEditing(null)}
          onDone={(v) => {
            if (editing.thenComplete) toggleDone(editing.ei, editing.si, v);
            else changeSet(editing.ei, editing.si, editing.field === "weight" ? { weight: v } : { reps: v });
            setEditing(null);
          }}
        />
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          note={pickerNote(w.entries.length, false)}
          onPick={(exerciseId) => {
            const entry = placeEntry(exerciseId, DEFAULT_TARGET, w.entries.length, false);
            if (!entry) return;
            setPicking(false);
            update((w) => ({ ...w, entries: [...w.entries, entry] }));
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
  nextSi,
  superset,
  past,
  onNote,
  onSuperset,
  readOnly,
  onEdit,
  onToggle,
  onFeel,
  onSwap,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  entry: Entry;
  last?: SetLog[];
  /** Index of the next set to do in this exercise (outlined), or -1. */
  nextSi: number;
  superset: string | null;
  past: ReturnType<typeof bests>;
  onNote: (note: string) => void;
  onSuperset: () => void;
  readOnly: boolean;
  onEdit: (si: number, field: "weight" | "reps") => void;
  onToggle: (si: number) => void;
  onFeel: (si: number, f: Feel) => void;
  onSwap: () => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const ex = getExercise(entry.exerciseId);
  const [showDemo, setShowDemo] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  if (!ex) return null;
  const { target } = entry;
  const unit = unitLabel(ex.unit);
  const wLabel = weightLabel(ex);
  const plateWeight = (entry.sets.find((s) => !s.done) ?? entry.sets.at(-1))?.weight ?? null;
  // Ask how the most recent completed set felt (reps-based exercises only).
  const lastDone = entry.sets.reduce((acc, s, i) => (s.done ? i : acc), -1);
  const askAt = ex.unit === "reps" && lastDone >= 0 && !entry.sets[lastDone].feel ? lastDone : -1;
  const rest = target.restSec >= 60 ? `${Math.floor(target.restSec / 60)}:${String(target.restSec % 60).padStart(2, "0")}` : `${target.restSec}s`;

  return (
    <Card className={`!p-0 ${superset ? "border-l-4 !border-l-accent" : ""}`}>
      <div className="p-4 pb-2">
        {superset && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">{superset}</p>}
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/exercises/${ex.id}`} className="text-lg font-semibold tracking-tight">
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
        {entry.hint && !readOnly && <p className="mt-2 text-sm text-accent">{entry.hint}</p>}
        {editingNote ? (
          <input
            autoFocus
            defaultValue={entry.note ?? ""}
            placeholder="e.g. seat on notch 4, grip just outside the rings"
            className="mt-2 w-full rounded-lg border border-line bg-card-2 px-3 py-2 text-sm"
            onBlur={(e) => {
              onNote(e.target.value);
              setEditingNote(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : entry.note ? (
          <button className="mt-2 block text-left text-sm text-muted" disabled={readOnly} onClick={() => setEditingNote(true)}>
            📝 {entry.note}
          </button>
        ) : (
          !readOnly && (
            <button className="mt-1 text-xs text-muted" onClick={() => setEditingNote(true)}>
              + Add note
            </button>
          )
        )}
        {ex.load === "barbell" && !readOnly && !entry.sets.some((s) => s.done) && entry.sets[0]?.weight != null && warmupSets(entry.sets[0].weight).length > 0 && (
          <p className="mt-1 text-xs text-muted">
            Warm up first: {warmupSets(entry.sets[0].weight).map((w) => `${w.kg === 20 ? "bar" : `${w.kg} kg`} × ${w.reps}`).join(", ")}
          </p>
        )}
        {showDemo && (
          <div className="mt-3 space-y-2">
            <ExerciseDemo images={ex.images} name={ex.name} videoId={ex.id} />
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {ex.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {ex.mistakes.length > 0 && <p className="text-xs text-muted">Avoid: {ex.mistakes.join("; ").toLowerCase()}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1.75rem_3.75rem_1fr_1fr_3.5rem] items-center gap-2 px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span className="text-center">Set</span>
        <span>Previous</span>
        <span className="text-center">{wLabel || " "}</span>
        <span className="text-center">{unit}</span>
        <span />
      </div>
      <div className="space-y-1.5 px-4 pb-3">
        {entry.sets.map((s, si) => (
          <SetRow
            key={si}
            index={si}
            set={s}
            prev={readOnly ? undefined : last?.[si]}
            isNext={!readOnly && si === nextSi}
            pr={!readOnly && isLivePr(entry, si, past)}
            showWeight={!!wLabel}
            repsPlaceholder={entry.goalReps ? String(entry.goalReps) : `${target.repMin}–${target.repMax}`}
            readOnly={readOnly}
            askFeel={!readOnly && si === askAt}
            onEdit={(field) => onEdit(si, field)}
            onToggle={() => onToggle(si)}
            onFeel={(f) => onFeel(si, f)}
          />
        ))}
        {ex.load === "barbell" && plateWeight != null && !readOnly && (
          <p className="pt-1 text-xs text-muted">
            {plateWeight} kg · {describePlates(plateWeight)}
          </p>
        )}
      </div>
      {!readOnly && (
      <div className="flex border-t border-line text-sm">
        <button className="flex-1 py-3.5 text-accent" onClick={onAddSet}>
          + Set
        </button>
        <button className="flex-1 py-3.5 text-muted disabled:opacity-40" onClick={onRemoveSet} disabled={entry.sets.length <= 1}>
          − Set
        </button>
        <button className="flex-1 py-3.5 text-muted" onClick={onSwap}>
          Swap
        </button>
        <button className={`flex-1 py-3.5 ${superset ? "text-accent" : "text-muted"}`} onClick={onSuperset}>
          {superset ? "Unpair" : "Superset"}
        </button>
        <button className="flex-1 py-3.5 text-muted" onClick={onRemove}>
          Remove
        </button>
      </div>
      )}
    </Card>
  );
}

function HeartRateChip({ hr }: { hr: NonNullable<ReturnType<typeof useHeartRate>> }) {
  const text =
    hr.status === "connected"
      ? hr.bpm != null
        ? `${hr.bpm} bpm`
        : `${hr.device ?? "Strap"} connected`
      : hr.status === "searching"
        ? "Looking for heart rate strap…"
        : hr.status === "bluetooth-off"
          ? (hr.message ?? "Turn on Bluetooth")
          : hr.status === "error"
            ? "Heart rate strap unavailable"
            : null;
  if (!text) return null;
  return (
    <p className={`mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums ${hr.bpm != null ? "font-semibold text-text" : "text-muted"}`}>
      <span aria-hidden className={hr.bpm != null ? "text-danger" : ""}>♥</span>
      {text}
    </p>
  );
}

/** Shown only while changes are waiting on the phone for signal. */
function SyncNote() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Normal saves take a moment; only mention it if changes are still waiting after 3 s.
    let t: ReturnType<typeof setTimeout> | undefined;
    const check = (n: number) => {
      clearTimeout(t);
      if (!n) return setShow(false);
      t = setTimeout(() => setShow(pendingSync() > 0), 3000);
    };
    check(pendingSync());
    const on = (e: Event) => check((e as CustomEvent<number>).detail);
    window.addEventListener(SYNC_EVENT, on);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SYNC_EVENT, on);
    };
  }, []);
  if (!show) return null;
  return <p className="-mt-2 text-xs text-muted">No signal? Your sets are saved on this phone and will sync automatically.</p>;
}
