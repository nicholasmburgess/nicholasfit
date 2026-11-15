"use client";

import { useEffect, useRef, useState } from "react";

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    navigator.vibrate?.(300);
  } catch {
    // Sound is a nice-to-have.
  }
}

export function RestTimer({ endsAt, total, onAdd, onDone }: { endsAt: number; total: number; onAdd: (sec: number) => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    beeped.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !beeped.current) {
      beeped.current = true;
      beep();
    }
  }, [left]);

  const pct = Math.min(100, (1 - left / total) * 100);
  return (
    <div className="fixed inset-x-0 bottom-[calc(3rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2">
      <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-line bg-card-2 shadow-lg">
        <div className="h-1 bg-accent transition-all" style={{ width: `${pct}%` }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-muted">{left === 0 ? "Rest done" : "Rest"}</p>
            <p className={`text-2xl font-bold tabular-nums ${left === 0 ? "text-accent" : ""}`}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </p>
          </div>
          <button className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => onAdd(15)}>
            +15s
          </button>
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink" onClick={onDone}>
            {left === 0 ? "Close" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
