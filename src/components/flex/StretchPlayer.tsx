"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { EMPTY, flexStore, levelFor, newId, type FlexData, type Feel } from "@/lib/flexibility";
import { LEVELS, READY_SECONDS, SWITCH_SECONDS, blocksFor, getLevel, getStretch, routineMinutes, type Routine } from "@/lib/stretches";
import { StretchVideo } from "./StretchVideo";

type Seg = { block: number; kind: "prep" | "hold"; seconds: number };

/**
 * A routine from start to finish: pick the intensity, then a hands-free timer that calls each
 * stretch and each side switch with a beep, so the phone can sit on the floor.
 */
export function StretchPlayer({ routine }: { routine: Routine }) {
  const [data, setData] = useState<FlexData>(EMPTY);
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState<"pick" | "play" | "done">("pick");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    const local = flexStore.local();
    setData(local);
    setLevel(levelFor(local, routine.key));
    flexStore.load().then((d) => {
      setData(d);
      setLevel(levelFor(d, routine.key));
    });
  }, [routine.key]);

  async function finish(seconds: number, completed: boolean) {
    if (seconds < 60 && !completed) return;
    const id = newId();
    const entry = { id, at: new Date().toISOString(), routine: routine.key, level: routine.fixed ? 1 : level, seconds: Math.round(seconds), completed };
    const levels = routine.fixed ? data.levels : { ...data.levels, [routine.key]: level };
    setData(await flexStore.update((d) => ({ ...d, levels, sessions: [entry, ...d.sessions] })));
    setSavedId(id);
  }

  if (stage === "play")
    return (
      <Timer
        routine={routine}
        level={level}
        onExit={async (secs) => {
          await finish(secs, false);
          setStage(secs >= 60 ? "done" : "pick");
        }}
        onDone={async (secs) => {
          await finish(secs, true);
          setStage("done");
        }}
      />
    );
  if (stage === "done") return <Done routine={routine} sessionId={savedId} />;

  const blocks = blocksFor(routine, level);
  return (
    <main className="space-y-4 md:mx-auto md:max-w-2xl">
      <Link href="/flexibility" className="inline-block pt-2 text-sm text-accent">
        ‹ Flexibility
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{routine.name}</h1>
        <p className="text-sm text-muted">
          {routine.when} · {routineMinutes(routine, level)} min
        </p>
        <p className="mt-1 text-sm">{routine.why}</p>
      </header>

      {!routine.fixed && (
        <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <h2 className="mb-2 font-semibold">Intensity</h2>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-card-2 p-1">
            {LEVELS.map((l) => (
              <button
                key={l.n}
                onClick={() => setLevel(l.n)}
                className={`rounded-lg py-2.5 text-sm font-semibold ${l.n === level ? "bg-accent text-accent-ink" : "text-muted"}`}
                aria-pressed={l.n === level}
              >
                {l.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm">
            <b>{getLevel(level).hold} s</b> holds · {getLevel(level).tension}
          </p>
        </section>
      )}

      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {routine.steps.map((s, i) => {
          const st = getStretch(s.id)!;
          const secs = s.seconds ?? getLevel(level).hold;
          return (
            <li key={`${s.id}-${i}`}>
              <Link href={`/flexibility/stretch/${s.id}`} className="flex items-center gap-3 p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={st.images[1] ?? st.images[0]} alt="" className="h-12 w-16 rounded-lg bg-white object-contain" loading="lazy" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{st.name}</span>
                  <span className="block text-xs text-muted">
                    {secs} s{st.sides ? " each side" : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <button onClick={() => setStage("play")} className="w-full rounded-2xl bg-accent py-4 text-lg font-bold text-accent-ink shadow-card active:opacity-80">
          Start · {blocks.length} holds
        </button>
      </div>
    </main>
  );
}

function Timer({ routine, level, onExit, onDone }: { routine: Routine; level: number; onExit: (secs: number) => void; onDone: (secs: number) => void }) {
  const blocks = useMemo(() => blocksFor(routine, level), [routine, level]);
  const segs = useMemo<Seg[]>(
    () => blocks.flatMap((b, i) => [{ block: i, kind: "prep" as const, seconds: b.first ? READY_SECONDS : SWITCH_SECONDS }, { block: i, kind: "hold" as const, seconds: b.seconds }]),
    [blocks],
  );
  const [seg, setSeg] = useState(0);
  const [left, setLeft] = useState(segs[0].seconds * 1000);
  const [paused, setPaused] = useState(false);
  const [video, setVideo] = useState(false);
  const [extra, setExtra] = useState(0); // seconds added to this hold with "+15 s"
  const finished = useRef(false);
  const endAt = useRef(Date.now() + segs[0].seconds * 1000);
  const held = useRef(0); // seconds actually spent stretching
  const audio = useRef<AudioContext | null>(null);

  const beep = useCallback((freq: number, times = 1) => {
    const ctx = audio.current;
    if (!ctx) return;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t);
      o.stop(t + 0.2);
    }
  }, []);

  // Sound needs a tap to unlock on iPhone; Start was that tap.
  useEffect(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = new Ctx();
      void audio.current.resume();
    } catch {
      audio.current = null;
    }
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
      void audio.current?.close().catch(() => {});
    };
  }, []);

  const go = useCallback(
    (to: number) => {
      if (finished.current) return;
      setExtra(0);
      if (to >= segs.length) {
        finished.current = true;
        beep(880, 3);
        onDone(held.current);
        return;
      }
      setSeg(to);
      endAt.current = Date.now() + segs[to].seconds * 1000;
      setLeft(segs[to].seconds * 1000);
      if (segs[to].kind === "hold") beep(880);
      else if (to > 0) beep(660, 2);
    },
    [segs, beep, onDone],
  );

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const remaining = endAt.current - Date.now();
      if (remaining <= 0) {
        if (segs[seg].kind === "hold") held.current += segs[seg].seconds + extra;
        go(seg + 1);
      } else setLeft(remaining);
    }, 200);
    return () => clearInterval(t);
  }, [paused, seg, segs, go, extra]);

  const s = segs[seg];
  const b = blocks[s.block];
  const st = getStretch(b.id)!;
  const secs = Math.ceil(left / 1000);
  const total = s.seconds + extra;
  const frac = 1 - left / (total * 1000);
  const nextBlock = blocks[s.block + 1];
  const nextName = nextBlock && (nextBlock.id === b.id ? `Switch to ${nextBlock.side} side` : getStretch(nextBlock.id)?.name);
  const sideLabel = b.side ? `${b.side === "left" ? "Left" : "Right"} side` : null;
  const partial = () => held.current + (s.kind === "hold" ? total - left / 1000 : 0);

  const pause = () => {
    if (paused) endAt.current = Date.now() + left;
    setPaused(!paused);
  };
  const skip = () => {
    if (s.kind === "hold") held.current += total - left / 1000;
    go(seg + 1);
  };
  const back = () => {
    // Back to the start of this stretch, or the previous one if this has barely started.
    const startOfThis = segs.findIndex((x) => x.block === s.block);
    go(s.kind === "hold" && frac > 0.15 ? startOfThis + 1 : Math.max(0, startOfThis - 2));
  };
  const more = () => {
    endAt.current += 15_000;
    setLeft((l) => l + 15_000);
    setExtra((x) => x + 15);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 md:max-w-xl md:landscape:max-w-5xl md:landscape:px-8">
        <div className="flex items-center gap-3">
          <button onClick={() => onExit(partial())} className="h-11 rounded-xl px-1 text-base font-medium text-muted">
            End
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((s.block + (s.kind === "hold" ? frac : 0)) / blocks.length) * 100}%` }} />
          </div>
          <span className="w-12 text-right text-sm tabular-nums text-muted">
            {s.block + 1}/{blocks.length}
          </span>
        </div>

        <div className="flex flex-1 flex-col md:landscape:grid md:landscape:grid-cols-2 md:landscape:items-center md:landscape:gap-10">
        <div className="relative mt-3">
          {video ? <StretchVideo id={b.id} onFail={() => setVideo(false)} /> : <ExerciseDemo images={st.images} name={st.name} />}
          <button onClick={() => setVideo(!video)} className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            {video ? "Photos" : "▶ Video"}
          </button>
        </div>

        <div className="flex flex-1 flex-col md:landscape:flex-none">
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{s.kind === "prep" ? (b.first ? "Get ready" : "Switch sides") : (sideLabel ?? (st.kind === "move" ? "Keep moving" : "Hold"))}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{st.name}</h1>
          {sideLabel && s.kind === "prep" && <p className="text-lg font-semibold">{sideLabel}</p>}
          <p className="mt-1 text-sm text-muted">Feel it: {st.feel.toLowerCase()}</p>
        </div>

        <div className="my-auto flex flex-col items-center py-3">
          <Ring frac={frac} prep={s.kind === "prep"}>
            <span className={`text-6xl font-bold tabular-nums ${paused ? "text-muted" : ""}`}>{secs}</span>
          </Ring>
          <p className="mt-2 min-h-5 text-sm text-muted">{s.kind === "prep" ? st.cues[0] : nextName ? `Next: ${nextName}` : "Last one"}</p>
        </div>

        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
          <button onClick={back} className="h-16 rounded-2xl border border-line bg-card text-base font-semibold active:opacity-70" aria-label="Back">
            ‹ Back
          </button>
          <button onClick={pause} className="h-16 rounded-2xl bg-accent text-lg font-bold text-accent-ink active:opacity-80">
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={skip} className="h-16 rounded-2xl border border-line bg-card text-base font-semibold active:opacity-70" aria-label="Skip">
            Next ›
          </button>
        </div>
        {s.kind === "hold" && st.kind === "hold" && (
          <button onClick={more} className="mt-2 h-11 rounded-xl text-sm font-semibold text-accent">
            +15 s, I want to stay here
          </button>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ frac, prep, children }: { frac: number; prep: boolean; children: React.ReactNode }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-44 w-44 place-items-center md:h-56 md:w-56">
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--card-2)" strokeWidth="10" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={prep ? "var(--muted)" : "var(--accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, frac)))}
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>
      {children}
    </div>
  );
}

const FEELS: { key: Feel; label: string; note: string }[] = [
  { key: "easy", label: "Easy", note: "Could go deeper" },
  { key: "good", label: "Good", note: "Right amount" },
  { key: "hard", label: "Hard", note: "Too much" },
];

function Done({ routine, sessionId }: { routine: Routine; sessionId: string | null }) {
  const router = useRouter();
  const [feel, setFeel] = useState<Feel | null>(null);

  async function rate(f: Feel) {
    setFeel(f);
    if (sessionId) await flexStore.update((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, feel: f } : s)) }));
    router.push("/flexibility");
  }

  return (
    <main className="space-y-5 pt-10 text-center md:mx-auto md:max-w-xl">
      <p className="text-5xl" aria-hidden>
        ✓
      </p>
      <h1 className="text-2xl font-bold">{routine.name} done</h1>
      {sessionId && !routine.fixed ? (
        <>
          <p className="text-muted">How did that intensity feel?</p>
          <div className="grid grid-cols-3 gap-2">
            {FEELS.map((f) => (
              <button
                key={f.key}
                onClick={() => rate(f.key)}
                className={`rounded-2xl border px-2 py-4 ${feel === f.key ? "border-accent bg-accent text-accent-ink" : "border-line bg-card"}`}
              >
                <span className="block text-lg font-bold">{f.label}</span>
                <span className={`block text-xs ${feel === f.key ? "" : "text-muted"}`}>{f.note}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">This helps the app and Claude adjust your intensity.</p>
        </>
      ) : (
        <Link href="/flexibility" className="block rounded-xl bg-accent py-3 font-semibold text-accent-ink">
          Back to Flexibility
        </Link>
      )}
    </main>
  );
}
