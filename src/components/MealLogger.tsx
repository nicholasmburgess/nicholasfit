"use client";

import { useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button, Card } from "@/components/Card";
import { resizePhoto } from "@/lib/image";
import { forGrams, lookupBarcode, type Product } from "@/lib/off";
import { newId } from "@/lib/store";
import type { Meal, MealItem } from "@/lib/types";

type Estimate = { items: MealItem[]; kcal: number; protein: number; carbs: number; fat: number; confidence: string; note: string };

/** Distinct meals from recent history, most often eaten first. */
export function recentMeals(meals: Meal[], limit = 6): Meal[] {
  const groups = new Map<string, { meal: Meal; count: number }>();
  for (const m of [...meals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))) {
    const key = m.description.trim().toLowerCase();
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { meal: m, count: 1 });
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.meal.eatenAt.localeCompare(a.meal.eatenAt))
    .slice(0, limit)
    .map((g) => g.meal);
}

export function MealLogger({ eatenAt, onSave, recent = [] }: { eatenAt: () => string; onSave: (m: Meal) => Promise<void>; recent?: Meal[] }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [unit, setUnit] = useState<"serving" | "g">("g");
  const [amount, setAmount] = useState("100");

  async function repeat(m: Meal) {
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...m, id: newId(), eatenAt: eatenAt() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function scanned(code: string) {
    setScanning(false);
    setBusy(true);
    setError(null);
    try {
      const p = await lookupBarcode(code);
      if (!p) {
        setError(`Barcode ${code} isn't in Open Food Facts yet. Describe it or take a photo instead.`);
        return;
      }
      setProduct(p);
      setUnit(p.servingG ? "serving" : "g");
      setAmount(p.servingG ? "1" : "100");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  const grams = product ? (unit === "serving" ? Number(amount) * (product.servingG ?? 0) : Number(amount)) : 0;
  const scannedTotals = product && Number.isFinite(grams) && grams > 0 ? forGrams(product, grams) : null;

  async function saveProduct() {
    if (!product || !scannedTotals) return;
    const portion = unit === "serving" ? `${amount} × ${product.servingLabel ?? `${product.servingG} g`}` : `${Math.round(grams)} g`;
    setBusy(true);
    try {
      await onSave({
        id: newId(),
        eatenAt: eatenAt(),
        description: product.name,
        items: [{ name: product.name, portion, ...scannedTotals }],
        kcal: scannedTotals.kcal,
        protein: Math.round(scannedTotals.protein),
        carbs: Math.round(scannedTotals.carbs),
        fat: Math.round(scannedTotals.fat),
        confidence: "high",
      });
      setProduct(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

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
      {scanning && <BarcodeScanner onCode={scanned} onClose={() => setScanning(false)} />}
      {product ? (
        <>
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted">
              Per 100 g: {Math.round(product.per100.kcal)} kcal · {Math.round(product.per100.protein * 10) / 10} g protein
              {product.servingLabel ? ` · serving ${product.servingLabel}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-xl border border-line bg-card-2 px-3 py-2 text-base tabular-nums"
            />
            {product.servingG ? (
              <div className="flex flex-1 overflow-hidden rounded-xl border border-line text-sm">
                {(["serving", "g"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      setUnit(u);
                      setAmount(u === "serving" ? "1" : String(Math.round(product.servingG ?? 100)));
                    }}
                    className={`flex-1 ${unit === u ? "bg-accent font-semibold text-accent-ink" : "bg-card-2 text-muted"}`}
                  >
                    {u === "serving" ? "Servings" : "Grams"}
                  </button>
                ))}
              </div>
            ) : (
              <span className="self-center text-sm text-muted">grams</span>
            )}
          </div>
          {scannedTotals && (
            <p className="text-sm tabular-nums">
              {scannedTotals.kcal} kcal · <span className="text-accent">{Math.round(scannedTotals.protein)} g protein</span>
            </p>
          )}
          <p className="text-xs text-muted">From the label via Open Food Facts. Check it matches the packet.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setProduct(null)} disabled={busy}>
              Back
            </Button>
            <Button className="flex-1" onClick={saveProduct} disabled={busy || !scannedTotals}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </>
      ) : !est ? (
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
            <Button variant="secondary" className="flex-1" onClick={() => setScanning(true)} disabled={busy}>
              Barcode
            </Button>
            <Button className="flex-1" onClick={estimate} disabled={busy || (!text.trim() && !photo)}>
              {busy ? "Estimating…" : "Estimate"}
            </Button>
          </div>
          <p className="text-xs text-muted">A photo plus a few words (e.g. &quot;large serve, cooked in olive oil&quot;) gives the best estimate.</p>
          {recent.length > 0 && (
            <div className="space-y-1.5 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted">Eat it again? One tap logs it.</p>
              {recent.map((m) => (
                <button
                  key={m.id}
                  onClick={() => repeat(m)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-card-2 px-3 py-2 text-left text-sm active:opacity-80 disabled:opacity-50"
                >
                  <span className="truncate">{m.description}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {m.kcal} kcal · {m.protein} g
                  </span>
                </button>
              ))}
            </div>
          )}
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
