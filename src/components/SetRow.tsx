"use client";

import type { Feel, SetLog } from "@/lib/types";

const FEELS: { value: Feel; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "good", label: "Good" },
  { value: "hard", label: "Hard" },
];

export function SetRow({
  index,
  set,
  showWeight,
  repsPlaceholder,
  readOnly,
  askFeel,
  onEdit,
  onToggle,
  onFeel,
}: {
  index: number;
  set: SetLog;
  showWeight: boolean;
  repsPlaceholder: string;
  readOnly: boolean;
  askFeel?: boolean;
  onEdit: (field: "weight" | "reps") => void;
  onToggle: () => void;
  onFeel?: (f: Feel) => void;
}) {
  const field = `h-11 w-full rounded-lg border text-center text-base tabular-nums disabled:opacity-100 ${
    set.done ? "border-accent/30 bg-accent/10" : "border-line bg-card-2"
  }`;
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
        <span className="text-center text-sm text-muted">{index + 1}</span>
        {showWeight ? (
          <button aria-label={`Set ${index + 1} weight`} className={field} disabled={readOnly} onClick={() => onEdit("weight")}>
            {set.weight ?? <span className="text-muted">kg</span>}
          </button>
        ) : (
          <span className="text-center text-sm text-muted">—</span>
        )}
        <button aria-label={`Set ${index + 1} reps`} className={field} disabled={readOnly} onClick={() => onEdit("reps")}>
          {set.reps ?? <span className="text-muted">{repsPlaceholder}</span>}
        </button>
        <button
          aria-label={set.done ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
          onClick={onToggle}
          disabled={readOnly}
          className={`h-11 rounded-lg text-lg font-bold disabled:opacity-100 ${set.done ? "bg-accent text-accent-ink" : "border border-line bg-card-2 text-muted"}`}
        >
          ✓
        </button>
      </div>
      {askFeel && onFeel && (
        <div className="ml-10 flex items-center gap-1.5" role="group" aria-label={`How did set ${index + 1} feel?`}>
          <span className="mr-1 text-xs text-muted">How was it?</span>
          {FEELS.map((f) => (
            <button key={f.value} onClick={() => onFeel(f.value)} className="flex-1 rounded-full border border-line bg-card-2 py-1.5 text-xs active:bg-accent active:text-accent-ink">
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
