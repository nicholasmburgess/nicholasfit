"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { RowReviewCard } from "@/components/RowReviewCard";
import { foodStore } from "@/lib/food-store";
import { formatDate } from "@/lib/format";
import { listHealthDays } from "@/lib/health-store";
import { hasNativeWorkout, openOnPhone, postNative } from "@/lib/native";
import type { Plan } from "@/lib/plan";
import { planStore } from "@/lib/plan-store";
import { ZONE_PCT, formatSplit, rowLine, workoutRows } from "@/lib/row";
import { ROW_SESSIONS, type RowSession, easySplit, fourByFourUnlocked, harderRows, readiness, sessionSeconds, targetSplit, zonesMax } from "@/lib/row-sessions";
import { startWorkout } from "@/lib/start";
import type { Workout } from "@/lib/types";
import { useWorkouts } from "@/lib/useWorkouts";

const SEG_COLOUR = { warmup: "#9fb8a9", cooldown: "#9fb8a9", easy: "#9fb8a9", work: "" };
const ZONE_TAG: Record<string, { text: string; cls: string }> = {
  ROW: { text: "ZONE 2", cls: "bg-accent/10 text-accent" },
  ROW_TEMPO: { text: "ZONE 3", cls: "bg-[#fdf1dc] text-[#9a6512]" },
  ROW_1MIN: { text: "ZONE 4", cls: "bg-[#ffe9df] text-[#b5501d]" },
  ROW_4X4: { text: "ZONE 4–5", cls: "bg-[#fde3e0] text-[#b4332a]" },
};
const WORK_COLOUR: Record<string, string> = { ROW_TEMPO: "#f0b44c", ROW_1MIN: "#ff8a4c", ROW_4X4: "#ff6b5b" };

/** The shape of a session: warm-up, hard parts and easy parts, to scale. */
function SessionBar({ s }: { s: RowSession }) {
  return (
    <div className="mt-2 flex h-3.5 gap-0.5" aria-hidden>
      {s.segments.map((seg, i) => (
        <div key={i} className="rounded-sm" style={{ flex: seg.seconds, background: seg.kind === "work" ? WORK_COLOUR[s.key] : SEG_COLOUR[seg.kind] }} />
      ))}
    </div>
  );
}

/** Rows: pick a session (easy, tempo, intervals, 4 × 4), see targets, zones, recent rows and Claude's review. */
export default function RowPage() {
  const router = useRouter();
  const { workouts, error } = useWorkouts();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [signs, setSigns] = useState<string[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  useEffect(() => {
    planStore.get().then(setPlan);
    foodStore.getProfile().then((p) => setBirthYear(p?.birthYear ?? null)).catch(() => {});
    listHealthDays(28)
      .then((d) => {
        const r = readiness(d);
        if (r.suggestEasy) setSigns(r.signs);
      })
      .catch(() => {});
  }, []);
  if (!workouts || !plan) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const finished = workouts.filter((w) => w.finishedAt);
  const active = workouts.find((w) => !w.finishedAt);
  const coaching = plan.rowCoaching;
  const unlocked = fourByFourUnlocked(finished, coaching);
  const doneHard = harderRows(finished).length;
  const easy = easySplit(finished);
  const max = zonesMax(birthYear, coaching);
  const rows = finished.filter((w) => workoutRows(w).length || w.templateKey?.startsWith("ROW")).slice(0, 12);
  const lastGuided = harderRows(finished)[0]?.workout;
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
  const hardThisWeek = harderRows(finished).filter((r) => r.workout.startedAt >= weekAgo).length;

  async function start(key: string) {
    setStarting(key);
    const p = key === "ROW_4X4" && !plan!.rowCoaching?.fourByFourUnlocked ? { ...plan!, rowCoaching: { ...(plan!.rowCoaching ?? { targets: {}, measuredMaxHr: null }), fourByFourUnlocked: true } } : plan!;
    if (hasNativeWorkout()) {
      postNative({ type: "startWorkout", key, snapshot: { plan: p, history: finished.slice(0, 60) } });
      setTimeout(() => setStarting(null), 1500);
      return;
    }
    const id = await startWorkout(workouts!, key, p);
    router.push(`/workout/${id}`);
  }

  const zoneText = (lo: number, hi: number) => (max ? `${Math.round(max * ZONE_PCT[lo - 1])}–${Math.round(max * ZONE_PCT[hi])} bpm` : "");

  return (
    <main className="space-y-4 md:mx-auto md:max-w-3xl">
      <h1 className="pt-2 text-2xl font-bold">Row</h1>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {active && (
        <Card className="border-accent/50">
          <p className="text-sm text-muted">In progress</p>
          <h2 className="text-lg font-semibold">{active.name}</h2>
          {hasNativeWorkout() ? (
            <button className="mt-3 block w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink" onClick={() => openOnPhone(active)}>
              Resume
            </button>
          ) : (
            <Link href={`/workout/${active.id}`} className="mt-3 block rounded-xl bg-accent py-3 text-center text-sm font-semibold text-accent-ink">
              Resume
            </Link>
          )}
        </Card>
      )}

      {signs && (
        <Card className="border-warn/60">
          <h2 className="font-semibold">Recovery looks low today</h2>
          <p className="mt-1 text-sm text-muted">
            {signs.map((x) => x[0].toUpperCase() + x.slice(1)).join(" · ")}. An easy row today, and the harder one another day, will do more for you.
          </p>
        </Card>
      )}

      <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
        <SessionCard
          tag={ZONE_TAG.ROW}
          name="Easy row"
          minutes="20–30"
          text="Zone 2 the whole way: you could hold a conversation. Builds your aerobic base. Most of your rowing."
          target={easy ? `Your easy pace lately: ${formatSplit(easy, false)} /500m` : null}
          bar={<div className="mt-2 h-3.5 rounded-sm bg-accent/50" />}
          busy={starting === "ROW"}
          disabled={!!starting || !!active}
          onStart={() => start("ROW")}
          recommended={!!signs}
        />
        {ROW_SESSIONS.map((s) => {
          const locked = s.key === "ROW_4X4" && !unlocked;
          const t = targetSplit(s.key, finished, coaching);
          const note = coaching?.targets[s.key]?.note;
          return (
            <SessionCard
              key={s.key}
              tag={ZONE_TAG[s.key]}
              name={s.name}
              minutes={String(Math.round(sessionSeconds(s) / 60))}
              text={s.description}
              target={locked ? `Unlocks after 3 harder rows (${doneHard} of 3 done).` : t ? `Hard parts: ${formatSplit(t, false)} /500m${note ? ` · ${note}` : ""}` : "No target yet: the first one sets it."}
              bar={<SessionBar s={s} />}
              busy={starting === s.key}
              disabled={!!starting || !!active || locked}
              onStart={() => start(s.key)}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted">
        One harder row a week, on a day you don&apos;t lift, is plenty alongside three strength sessions.
        {hardThisWeek >= 1 ? ` You've done ${hardThisWeek} in the last 7 days.` : ""}
      </p>

      {lastGuided && <RowReviewCard workout={lastGuided} history={finished} onPlan={setPlan} />}

      <Card>
        <h2 className="font-semibold">Your heart-rate zones</h2>
        {max ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Max {max} bpm, {coaching?.measuredMaxHr && coaching.measuredMaxHr >= max ? "measured on your rows" : "estimated from your age (208 − 0.7 × age). It updates when a hard row goes higher."}
            </p>
            <ul className="mt-2 space-y-1 text-sm tabular-nums">
              <li>Zone 2 easy: {zoneText(2, 2)}</li>
              <li>Zone 3 tempo: {zoneText(3, 3)}</li>
              <li>Zone 4 hard: {zoneText(4, 4)}</li>
              <li>Zone 5 max: {zoneText(5, 5)}</li>
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Add your birth year in your profile (Food tab) to see your zones.</p>
        )}
      </Card>

      <section>
        <h2 className="mb-2 font-semibold">Recent rows</h2>
        {rows.length === 0 && <p className="text-sm text-muted">No rows yet. Rows from the PM5 show their distance, split and heart rate here.</p>}
        <ul className="space-y-2">
          {rows.map((w: Workout) => (
            <li key={w.id}>
              <Link href={`/workout/${w.id}`} className="block rounded-xl border border-line bg-card px-4 py-3">
                <span className="font-medium">{w.name}</span> <span className="text-sm text-muted">· {formatDate(w.startedAt)}</span>
                {workoutRows(w).map((r) => (
                  <span key={r.startedAt} className="block text-sm tabular-nums text-muted">
                    {rowLine(r)}
                  </span>
                ))}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function SessionCard({
  tag,
  name,
  minutes,
  text,
  target,
  bar,
  busy,
  disabled,
  onStart,
  recommended,
}: {
  tag: { text: string; cls: string };
  name: string;
  minutes: string;
  text: string;
  target: string | null;
  bar: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onStart: () => void;
  recommended?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${recommended ? "border-accent" : "border-line"}`}>
      <div className="flex gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide ${tag.cls}`}>{tag.text}</span>
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted">{minutes} MIN</span>
        {recommended && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-accent-ink">TODAY</span>}
      </div>
      <h3 className="mt-2 text-lg font-bold">{name}</h3>
      <p className="text-sm text-muted">{text}</p>
      {target && <p className="mt-1 text-sm font-medium">{target}</p>}
      {bar}
      <button className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-40" onClick={onStart} disabled={disabled}>
        {busy ? "Starting…" : `Start ${name}`}
      </button>
    </div>
  );
}
