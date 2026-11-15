"use client";

import type { SetLog } from "@/lib/types";

const parse = (v: string): number | null => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function SetRow({
  index,
  set,
  showWeight,
  repsPlaceholder,
  onChange,
  onToggle,
}: {
  index: number;
  set: SetLog;
  showWeight: boolean;
  repsPlaceholder: string;
  onChange: (patch: Partial<SetLog>) => void;
  onToggle: () => void;
}) {
  const field = `h-11 w-full rounded-lg border text-center text-base tabular-nums outline-none focus:border-accent ${
    set.done ? "border-accent/30 bg-accent/10" : "border-line bg-card-2"
  }`;
  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
      <span className="text-center text-sm text-muted">{index + 1}</span>
      {showWeight ? (
        <input
          aria-label={`Set ${index + 1} weight`}
          className={field}
          type="number"
          inputMode="decimal"
          step="0.5"
          placeholder="kg"
          value={set.weight ?? ""}
          onChange={(e) => onChange({ weight: parse(e.target.value) })}
        />
      ) : (
        <span className="text-center text-sm text-muted">—</span>
      )}
      <input
        aria-label={`Set ${index + 1} reps`}
        className={field}
        type="number"
        inputMode="numeric"
        placeholder={repsPlaceholder}
        value={set.reps ?? ""}
        onChange={(e) => onChange({ reps: parse(e.target.value) })}
      />
      <button
        aria-label={set.done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
        onClick={onToggle}
        className={`h-11 rounded-lg text-lg font-bold ${set.done ? "bg-accent text-accent-ink" : "border border-line bg-card-2 text-muted"}`}
      >
        ✓
      </button>
    </div>
  );
}
