"use client";

import { useState } from "react";
import { EXERCISES, PATTERNS } from "@/lib/exercises";

export function ExercisePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg/98 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 pb-3">
        <input
          autoFocus
          className="h-11 flex-1 rounded-lg border border-line bg-card-2 px-3 outline-none focus:border-accent"
          placeholder="Search exercises"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="px-2 text-sm text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {PATTERNS.map((p) => {
          const items = list.filter((e) => e.pattern === p);
          if (!items.length) return null;
          return (
            <section key={p} className="mb-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{p}</h3>
              {items.map((e) => (
                <button key={e.id} className="flex w-full items-center gap-3 border-b border-line py-2 text-left" onClick={() => onPick(e.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.images[1] ?? e.images[0]} alt="" className="h-12 w-16 rounded bg-white object-contain" />
                  <span>
                    <span className="block">{e.name}</span>
                    <span className="text-xs capitalize text-muted">{e.load}</span>
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
