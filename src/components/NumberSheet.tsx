"use client";

import { useState } from "react";

/** Bottom sheet with big −/+ buttons so weights and reps can be set without the keyboard. */
export function NumberSheet({
  title,
  unit,
  initial,
  step,
  bigStep,
  decimals,
  onDone,
  onClose,
}: {
  title: string;
  unit: string;
  initial: number;
  step: number;
  bigStep?: number;
  decimals: boolean;
  onDone: (v: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [text, setText] = useState(String(initial));
  const set = (v: number) => {
    const clean = Math.max(0, Math.round(v * 100) / 100);
    setValue(clean);
    setText(String(clean));
  };
  const btn = "h-14 rounded-xl border border-line bg-card-2 text-lg font-semibold active:opacity-70";

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-3xl border border-line bg-card px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <p className="text-center text-sm text-muted">{title}</p>
        <div className="my-3 flex items-baseline justify-center gap-2">
          <input
            aria-label={title}
            className="w-36 bg-transparent text-right text-5xl font-bold tabular-nums outline-none"
            inputMode={decimals ? "decimal" : "numeric"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = parseFloat(e.target.value.replace(",", "."));
              if (Number.isFinite(n)) setValue(n);
            }}
          />
          <span className="text-lg text-muted">{unit}</span>
        </div>
        <div className={`grid gap-2 ${bigStep ? "grid-cols-4" : "grid-cols-2"}`}>
          {bigStep && (
            <button className={btn} onClick={() => set(value - bigStep)}>
              −{bigStep}
            </button>
          )}
          <button className={btn} onClick={() => set(value - step)}>
            −{step}
          </button>
          <button className={btn} onClick={() => set(value + step)}>
            +{step}
          </button>
          {bigStep && (
            <button className={btn} onClick={() => set(value + bigStep)}>
              +{bigStep}
            </button>
          )}
        </div>
        <button className="mt-3 h-14 w-full rounded-xl bg-accent text-base font-semibold text-accent-ink" onClick={() => onDone(value)}>
          Done
        </button>
      </div>
    </div>
  );
}
