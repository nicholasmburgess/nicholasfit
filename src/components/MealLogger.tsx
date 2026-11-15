"use client";

import { useRef, useState } from "react";
import { Button, Card } from "@/components/Card";
import { resizePhoto } from "@/lib/image";
import { newId } from "@/lib/store";
import type { Meal, MealItem } from "@/lib/types";

type Estimate = { items: MealItem[]; kcal: number; protein: number; carbs: number; fat: number; confidence: string; note: string };

export function MealLogger({ eatenAt, onSave }: { eatenAt: () => string; onSave: (m: Meal) => Promise<void> }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      setPhoto(await resizePhoto(f));
    } catch {
      setError("Couldn't read that photo");
    }
  }

  async function estimate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meal-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text, image: photo ?? undefined }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response" }));
      if (!res.ok) throw new Error(data.error ?? "Estimate failed");
      setEst(data);
      setKcal(String(data.kcal));
      setProtein(String(data.protein));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setPhoto(null);
    setEst(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!est) return;
    const k = Number(kcal), p = Number(protein);
    // If totals were edited, scale carbs and fat with calories so the meal stays consistent.
    const ratio = est.kcal > 0 && Number.isFinite(k) ? k / est.kcal : 1;
    setBusy(true);
    try {
      await onSave({
        id: newId(),
        eatenAt: eatenAt(),
        description: text.trim() || est.items.map((i) => i.name).join(", "),
        items: est.items,
        kcal: Number.isFinite(k) ? Math.round(k) : est.kcal,
        protein: Number.isFinite(p) ? Math.round(p) : est.protein,
        carbs: Math.round(est.carbs * ratio),
        fat: Math.round(est.fat * ratio),
        confidence: est.confidence,
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Log a meal</h2>
      {!est ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="e.g. chicken burrito bowl and a flat white"
            className="w-full resize-none rounded-xl border border-line bg-card-2 px-3 py-2 text-base outline-none placeholder:text-muted focus:border-accent"
          />
          {photo && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:image/jpeg;base64,${photo}`} alt="Meal photo" className="max-h-48 w-full rounded-xl object-cover" />
              <button onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} className="absolute right-2 top-2 rounded-full bg-bg/80 px-2.5 py-1 text-sm">
                ✕
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
              {photo ? "Change photo" : "📷 Photo"}
            </Button>
            <Button className="flex-1" onClick={estimate} disabled={busy || (!text.trim() && !photo)}>
              {busy ? "Estimating…" : "Estimate"}
            </Button>
          </div>
          <p className="text-xs text-muted">A photo plus a few words (e.g. &quot;large serve, cooked in olive oil&quot;) gives the best estimate.</p>
        </>
      ) : (
        <>
          <ul className="divide-y divide-line text-sm">
            {est.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-1.5">
                <span>
                  {i.name} <span className="text-muted">· {i.portion}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {Math.round(i.kcal)} kcal · {Math.round(i.protein)} g P
                </span>
              </li>
            ))}
          </ul>
          {est.note && <p className="text-xs text-muted">{est.note}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Calories
              <input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-base text-text tabular-nums" />
            </label>
            <label className="text-xs text-muted">
              Protein (g)
              <input inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-base text-text tabular-nums" />
            </label>
          </div>
          <p className="text-xs text-muted">Confidence: {est.confidence}. Adjust the numbers if you know better.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEst(null)} disabled={busy}>
              Back
            </Button>
            <Button className="flex-1" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save meal"}
            </Button>
          </div>
        </>
      )}
      {error && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
