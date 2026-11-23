"use client";

import { useState } from "react";
import { Button } from "@/components/Card";
import { TESTS, flexStore, newId, type FlexData, type TestKind } from "@/lib/flexibility";

/** Bottom sheet: how to do one flexibility test, then the result in cm (one side or both). */
export function TestSheet({ kind, onClose, onSaved }: { kind: TestKind; onClose: () => void; onSaved: (d: FlexData) => void }) {
  const t = TESTS[kind];
  const [vals, setVals] = useState<Record<string, string>>({});
  const fields = t.sides ? ["left", "right"] : ["value"];
  const num = (k: string) => {
    const n = parseFloat((vals[k] ?? "").replace(",", ".").replace("−", "-"));
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
  };
  const ready = fields.every((f) => num(f) != null);

  async function save() {
    const entry = { id: newId(), at: new Date().toISOString(), kind, ...Object.fromEntries(fields.map((f) => [f, num(f)])) };
    onSaved(await flexStore.update((d) => ({ ...d, tests: [entry, ...d.tests] })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-bold">{t.name}</h2>
        <p className="text-sm text-muted">{t.area}</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          {t.how.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
        <div className={`mt-4 grid gap-3 ${fields.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {fields.map((f) => (
            <label key={f} className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">{f === "value" ? "Result" : f === "left" ? "Left" : "Right"}</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-line bg-card-2 px-3">
                <button
                  type="button"
                  className="h-12 w-8 text-xl text-muted"
                  aria-label="Make negative or positive"
                  onClick={() => setVals((v) => ({ ...v, [f]: (v[f] ?? "").startsWith("-") ? (v[f] ?? "").slice(1) : `-${v[f] ?? ""}` }))}
                >
                  ±
                </button>
                <input
                  inputMode="decimal"
                  className="h-12 min-w-0 flex-1 bg-transparent text-2xl font-bold tabular-nums outline-none"
                  placeholder="0"
                  value={vals[f] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [f]: e.target.value }))}
                />
                <span className="text-muted">cm</span>
              </div>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t.hint}. Tap ± to switch.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
