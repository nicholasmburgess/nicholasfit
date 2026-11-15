"use client";

import type { SetLog } from "@/lib/types";

export function SetRow({
  index,
  set,
  showWeight,
  repsPlaceholder,
  readOnly,
  onEdit,
  onToggle,
}: {
  index: number;
  set: SetLog;
  showWeight: boolean;
  repsPlaceholder: string;
  readOnly: boolean;
  onEdit: (field: "weight" | "reps") => void;
  onToggle: () => void;
}) {
  const field = `h-11 w-full rounded-lg border text-center text-base tabular-nums disabled:opacity-100 ${
    set.done ? "border-accent/30 bg-accent/10" : "border-line bg-card-2"
  }`;
  return (
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
  );
}
