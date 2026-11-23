"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/Card";
import { LiftLine, WeeklyBars } from "@/components/Charts";
import {
  EMPTY,
  TESTS,
  daysSince,
  flexStore,
  levelFor,
  levelHint,
  minutesByWeek,
  reviewInput,
  testScore,
  type FlexData,
  type FlexReview,
  type TestKind,
} from "@/lib/flexibility";
import { AREAS, ROUTINES, STRETCHES, getLevel, getRoutine, routineMinutes } from "@/lib/stretches";
import { TestSheet } from "./TestSheet";

export function FlexHome() {
  const [data, setData] = useState<FlexData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [test, setTest] = useState<TestKind | null>(null);

  useEffect(() => {
    setData(flexStore.local());
    flexStore.load().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  const setLevel = async (routine: string, level: number) => setData(await flexStore.update((d) => ({ ...d, levels: { ...d.levels, [routine]: level } })));

  const last = data.sessions[0];
  const ago = daysSince(last?.at);
  const monthMins = Math.round(data.sessions.filter((s) => daysSince(s.at)! < 30).reduce((t, s) => t + s.seconds, 0) / 60);

  return (
    <main className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Flexibility</h1>
        <p className="text-sm text-muted">Stretch whenever suits you. Every minute counts, and Claude keeps track of how you&apos;re going.</p>
      </header>

      {loaded && data.sessions.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <Card className="!p-3">
            <p className="text-xl font-bold tabular-nums">{ago === 0 ? "Today" : ago === 1 ? "Yesterday" : `${ago} days`}</p>
            <p className="text-xs text-muted">{ago != null && ago > 1 ? "since last stretch" : "last stretch"}</p>
          </Card>
          <Card className="!p-3">
            <p className="text-xl font-bold tabular-nums">{monthMins} min</p>
            <p className="text-xs text-muted">last 30 days</p>
          </Card>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Routines</h2>
        {ROUTINES.map((r) => {
          const level = levelFor(data, r.key);
          const hint = r.fixed ? null : levelHint(data, r.key);
          return (
            <div key={r.key} className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
              <Link href={`/flexibility/${r.key}`} className="flex items-center gap-3 p-4 active:opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted">
                    {r.when} · {routineMinutes(r, level)} min{r.fixed ? "" : ` · ${getLevel(level).name}`}
                  </p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </Link>
              {hint && (
                <div className="flex items-center gap-3 border-t border-line bg-card-2 px-4 py-2.5 text-sm">
                  <p className="flex-1">
                    {hint.why} Try <b>{getLevel(hint.to).name}</b>?
                  </p>
                  <button className="rounded-lg px-3 py-1.5 font-semibold text-accent" onClick={() => setLevel(r.key, hint.to)}>
                    {hint.to > level ? "Step up" : "Ease off"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <ReviewCard data={data} onData={setData} />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Flexibility tests</h2>
        <Card className="space-y-4">
          <p className="text-sm text-muted">Quick tape-measure checks that show real progress. Redo them every few weeks, whenever you like.</p>
          {(Object.keys(TESTS) as TestKind[]).map((k) => {
            const points = data.tests
              .filter((t) => t.kind === k)
              .map((t) => ({ date: t.at, value: testScore(t) }))
              .filter((p): p is { date: string; value: number } => p.value != null)
              .reverse();
            const latest = data.tests.find((t) => t.kind === k);
            return (
              <div key={k} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{TESTS[k].name}</p>
                    <p className="text-xs text-muted">
                      {TESTS[k].area}
                      {latest && ` · ${latest.value != null ? fmt(latest.value) : `L ${fmt(latest.left)} · R ${fmt(latest.right)}`}`}
                    </p>
                  </div>
                  <button className="rounded-xl border border-line px-3 py-2 text-sm font-medium text-accent" onClick={() => setTest(k)}>
                    {latest ? "Retest" : "Test"}
                  </button>
                </div>
                {points.length > 1 && <LiftLine points={points} unit="cm" name="" />}
              </div>
            );
          })}
        </Card>
      </section>

      {data.sessions.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Minutes stretched</h2>
          <WeeklyBars data={minutesByWeek(data.sessions)} format={(v) => `${v} min`} label="Minutes stretched per week" />
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">All stretches</h2>
        {AREAS.map((a) => (
          <div key={a} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">{a}</h3>
            <ul className="grid grid-cols-2 gap-2">
              {STRETCHES.filter((s) => s.area === a).map((s) => (
                <li key={s.id}>
                  <Link href={`/flexibility/stretch/${s.id}`} className="block overflow-hidden rounded-xl border border-line bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.images[1] ?? s.images[0]} alt="" className="aspect-[4/3] w-full bg-white object-contain" loading="lazy" />
                    <span className="block px-3 pt-2 text-sm font-medium leading-tight">{s.name}</span>
                    <span className="block px-3 pb-2 text-xs text-muted">{s.kind === "move" ? "Moving drill" : "Hold"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Evidence />

      {test && (
        <TestSheet
          kind={test}
          onClose={() => setTest(null)}
          onSaved={(d) => {
            setData(d);
            setTest(null);
          }}
        />
      )}
    </main>
  );
}

const fmt = (v: number | undefined) => (v == null ? "–" : `${v > 0 ? "+" : ""}${v} cm`);

function ReviewCard({ data, onData }: { data: FlexData; onData: (d: FlexData) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const review = data.review;
  const newSince = review ? data.sessions.filter((s) => s.at > review.at).length + data.tests.filter((t) => t.at > review.at).length : data.sessions.length + data.tests.length;
  const canAsk = data.sessions.length + data.tests.length > 0;

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/flex-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reviewInput(data)) });
      const out = await res.json().catch(() => ({ error: "Unexpected response" }));
      if (!res.ok) throw new Error(out.error ?? "Review failed");
      const next: FlexReview = { at: new Date().toISOString(), ...(out as Omit<FlexReview, "at">) };
      onData(await flexStore.update((d) => ({ ...d, review: next })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply(routine: string, level: number) {
    onData(
      await flexStore.update((d) => ({
        ...d,
        levels: { ...d.levels, [routine]: level },
        review: d.review && { ...d.review, suggestions: d.review.suggestions.filter((s) => s.routine !== routine) },
      })),
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Claude&apos;s review</h2>
        {review && <span className="text-xs text-muted">{new Date(review.at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
      </div>
      {review ? (
        <>
          <p className="text-sm">{review.summary}</p>
          {review.focus.length > 0 && <p className="text-sm text-muted">Focus on: {review.focus.join(", ")}</p>}
          {review.suggestions.map((s) => {
            const r = getRoutine(s.routine);
            if (!r || levelFor(data, s.routine) === s.level) return null;
            return (
              <div key={s.routine} className="flex items-center gap-3 rounded-xl bg-card-2 p-3 text-sm">
                <p className="flex-1">
                  <b>
                    {r.name} → {getLevel(s.level).name}
                  </b>
                  <br />
                  <span className="text-muted">{s.reason}</span>
                </p>
                <button className="rounded-lg bg-accent px-3 py-2 font-semibold text-accent-ink" onClick={() => apply(s.routine, s.level)}>
                  Apply
                </button>
              </div>
            );
          })}
        </>
      ) : (
        <p className="text-sm text-muted">Do a routine or a test, then ask Claude to look at your progress and suggest what to change.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {canAsk && (newSince > 0 || !review) && (
        <Button variant={review ? "secondary" : "primary"} className="w-full" disabled={busy} onClick={ask}>
          {busy ? "Claude is reviewing…" : review ? `Review again (${newSince} new)` : "Ask Claude to review"}
        </Button>
      )}
    </Card>
  );
}

function Evidence() {
  return (
    <details className="rounded-2xl border border-line bg-card p-4 text-sm">
      <summary className="font-semibold">How this is set up</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Range of motion grows with total stretching time. About 5 minutes per area each week, over several days, gives the biggest gains. Do it whenever suits you; it all adds up.</li>
        <li>The type of stretch matters less than the time spent, so the routines use simple holds you can do at home.</li>
        <li>Lifting through a full range (deep squats, full RDLs) improves flexibility too.</li>
        <li>Before lifting, use the Warm-up drills. Save long holds for after lifting or another time.</li>
        <li>Intensity: start Gentle. Step up when it feels easy; ease off if it feels hard. Stretch to tension, never pain.</li>
        <li>Stretching won&apos;t stop next-day soreness, so don&apos;t judge it by that.</li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        Sources:{" "}
        <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/29506306/">Thomas 2018</a>,{" "}
        <a className="underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10980866">Konrad 2024</a>,{" "}
        <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/33917036/">Afonso 2021</a>,{" "}
        <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/26642915/">Behm 2016</a>,{" "}
        <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/21735398/">Herbert 2011 (Cochrane)</a>. Photos from{" "}
        <a className="underline" href="https://github.com/yuhonas/free-exercise-db">Free Exercise DB</a> (public domain).
      </p>
    </details>
  );
}
