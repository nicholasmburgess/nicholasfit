"use client";

import { useState } from "react";
import { Button, Card } from "@/components/Card";
import type { Profile, Sex } from "@/lib/types";

const input = "mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-base text-text tabular-nums";

export function ProfileForm({ initial, onSave }: { initial: Profile | null; onSave: (p: Profile) => Promise<void> }) {
  const [age, setAge] = useState(initial ? String(new Date().getFullYear() - initial.birthYear) : "");
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : "");
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "male");
  const [busy, setBusy] = useState(false);
  const a = Number(age), h = Number(height);
  const valid = a >= 14 && a <= 100 && h >= 120 && h <= 230;
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Your details</h2>
        <p className="text-sm text-muted">Used to work out your daily calorie and protein targets.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Age
          <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-muted">
          Height (cm)
          <input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} className={input} />
        </label>
      </div>
      <div className="flex gap-2">
        {(["male", "female"] as Sex[]).map((s) => (
          <button key={s} onClick={() => setSex(s)} className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${sex === s ? "border-accent text-accent" : "border-line text-muted"}`}>
            {s}
          </button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true);
          await onSave({ heightCm: h, sex, birthYear: new Date().getFullYear() - a }).finally(() => setBusy(false));
        }}
      >
        Save
      </Button>
    </Card>
  );
}

export function WeightForm({ onSave, onCancel }: { onSave: (kg: number) => Promise<void>; onCancel?: () => void }) {
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(kg.replace(",", "."));
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Body weight</h2>
        <p className="text-sm text-muted">Weigh yourself in the morning. Your Withings scale will fill this in automatically once it&apos;s connected.</p>
      </div>
      <label className="text-xs text-muted">
        Weight (kg)
        <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className={input} />
      </label>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!(n >= 30 && n <= 300) || busy}
          onClick={async () => {
            setBusy(true);
            await onSave(Math.round(n * 10) / 10).finally(() => setBusy(false));
          }}
        >
          Save weight
        </Button>
      </div>
    </Card>
  );
}
