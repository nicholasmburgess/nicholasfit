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
  prev,
  isNext,
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
  /** Same set last session, shown in the Previous column. */
  prev?: SetLog;
  /** The next set to do, outlined so it's easy to find mid-workout. */
  isNext?: boolean;
  showWeight: boolean;
  repsPlaceholder: string;
  readOnly: boolean;
  askFeel?: boolean;
  onEdit: (field: "weight" | "reps") => void;
  onToggle: () => void;
  onFeel?: (f: Feel) => void;
}) {
  const field = `h-12 w-full rounded-xl text-center text-xl font-semibold tabular-nums disabled:opacity-100 ${
    set.done ? "bg-transparent" : "bg-card-2"
  }`;
  const prevText = prev && prev.done && prev.reps != null ? (prev.weight != null ? `${prev.weight} × ${prev.reps}` : `${prev.reps}`) : "–";
  return (
    <div className="space-y-1.5">
      <div
        className={`-mx-1.5 grid grid-cols-[1.75rem_3.75rem_1fr_1fr_3.5rem] items-center gap-2 rounded-2xl px-1.5 py-1 ${
          set.done ? "bg-accent/10" : isNext ? "ring-2 ring-inset ring-accent" : ""
        }`}
      >
        <span className="text-center text-base font-semibold">{index + 1}</span>
        <span className="truncate text-sm tabular-nums text-muted">{prevText}</span>
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
          className={`h-12 rounded-xl text-xl font-bold disabled:opacity-100 ${set.done ? "bg-accent text-accent-ink" : isNext ? "border-2 border-accent text-accent" : "border-2 border-line text-muted"}`}
        >
          ✓
        </button>
      </div>
      {askFeel && onFeel && (
        <div className="flex items-center gap-2 pl-8" role="group" aria-label={`How did set ${index + 1} feel?`}>
          <span className="mr-1 text-xs text-muted">How was it?</span>
          {FEELS.map((f) => (
            <button key={f.value} onClick={() => onFeel(f.value)} className="flex-1 rounded-xl border border-line bg-card py-2.5 text-sm font-medium active:bg-accent active:text-accent-ink">
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
