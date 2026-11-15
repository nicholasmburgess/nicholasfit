"use client";

import { useCallback, useEffect, useState } from "react";
import { ProfileForm, WeightForm } from "@/components/BodySetup";
import { AiStatus } from "@/components/AiStatus";
import { Card } from "@/components/Card";
import { MealLogger } from "@/components/MealLogger";
import { foodError, foodStore } from "@/lib/food-store";
import { SOURCES, dailyTargets, dayRange, dayTotals } from "@/lib/nutrition";
import { newId } from "@/lib/store";
import type { Meal, Profile, WeightEntry } from "@/lib/types";

function Bar({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = Math.min(100, (value / target) * 100);
  const left = target - value;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          <span className="font-semibold text-text">{Math.round(value).toLocaleString("en-AU")}</span> / {target.toLocaleString("en-AU")} {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-card-2">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {left >= 0 ? `${Math.round(left).toLocaleString("en-AU")} ${unit} left` : `${Math.round(-left).toLocaleString("en-AU")} ${unit} over`}
      </p>
    </div>
  );
}

export default function FoodPage() {
  const [offset, setOffset] = useState(0);
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [editing, setEditing] = useState<"profile" | "weight" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = dayRange(offset);
    try {
      const [m, p, w] = await Promise.all([foodStore.listMeals(start.toISOString(), end.toISOString()), foodStore.getProfile(), foodStore.listWeights()]);
      setMeals(m);
      setProfile(p);
      setWeights(w);
      setError(null);
    } catch (e) {
      setError(foodError(e));
      setMeals([]);
      setProfile(null);
    }
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (meals === null || profile === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;

  const weight = weights.at(-1);
  const targets = profile && weight ? dailyTargets(profile, weight.kg) : null;
  const totals = dayTotals(meals);
  const { start } = dayRange(offset);
  const dayLabel = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : start.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });

  const eatenAt = () => {
    if (offset === 0) return new Date().toISOString();
    const d = new Date(start);
    d.setHours(12);
    return d.toISOString();
  };

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      setEditing(null);
      await load();
    } catch (e) {
      setError(foodError(e));
    }
  }

  return (
    <main className="space-y-4">
      <header className="flex items-end justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Food</h1>
          <p className="text-sm text-muted">{dayLabel}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOffset(offset - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm" aria-label="Previous day">
            ‹
          </button>
          <button onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset === 0} className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-40" aria-label="Next day">
            ›
          </button>
        </div>
      </header>
      {error && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {(!profile || editing === "profile") && <ProfileForm initial={profile} onSave={(p) => run(() => foodStore.saveProfile(p))} />}
      {profile && (!weight || editing === "weight") && editing !== "profile" && (
        <WeightForm
          onCancel={weight ? () => setEditing(null) : undefined}
          onSave={(kg) => run(() => foodStore.saveWeight({ id: newId(), measuredAt: new Date().toISOString(), kg, source: "manual" }))}
        />
      )}

      {targets && (
        <Card className="space-y-4">
          <Bar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" />
          <Bar label="Protein" value={totals.protein} target={targets.protein} unit="g" />
          <p className="text-xs text-muted">
            Carbs {Math.round(totals.carbs)} g · Fat {Math.round(totals.fat)} g · Target is about {targets.tdee - targets.kcal} kcal under maintenance, for steady fat loss
            while you build muscle.
          </p>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer text-accent">How these targets are worked out</summary>
            <div className="mt-2 space-y-2">
              <p>
                Calories: resting energy from the Mifflin-St Jeor equation (the most accurate in a systematic review), times 1.45 for a desk job plus three strength
                sessions a week. That gives maintenance of about {targets.tdee.toLocaleString("en-AU")} kcal. The target is 20% below that (at most 500 kcal), which
                works out to roughly 0.5 kg of fat loss a week. That rate best protects muscle while you lose fat.
              </p>
              <p>
                Protein: 2 g per kg. Muscle gain plateaus at about 1.6 g/kg on average, and needs are higher while eating below maintenance. Above a healthy-weight
                BMI, it&apos;s based on that weight, so the target tracks lean mass.
              </p>
              <p>These are starting estimates. Once your Withings weigh-ins are flowing, the targets should be adjusted to your real weekly trend.</p>
              <ul className="list-disc space-y-1 pl-4">
                {SOURCES.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </Card>
      )}

      <MealLogger key={offset} eatenAt={eatenAt} onSave={(m) => run(() => foodStore.saveMeal(m))} />

      <section>
        <h2 className="mb-2 font-semibold">Meals</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged {offset === 0 ? "yet today" : "this day"}.</p>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.description}</p>
                  <p className="text-sm text-muted">
                    {new Date(m.eatenAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })} · {Math.round(m.kcal)} kcal · {Math.round(m.protein)} g protein
                  </p>
                </div>
                <button
                  onClick={() => confirm(`Delete "${m.description}"?`) && run(() => foodStore.deleteMeal(m.id))}
                  className="shrink-0 px-1 text-muted"
                  aria-label={`Delete ${m.description}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile && weight && !editing && (
        <p className="text-center text-xs text-muted">
          Based on {weight.kg} kg ({new Date(weight.measuredAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}).{" "}
          <button className="text-accent" onClick={() => setEditing("weight")}>
            Update weight
          </button>{" "}
          ·{" "}
          <button className="text-accent" onClick={() => setEditing("profile")}>
            Edit details
          </button>
        </p>
      )}
      <AiStatus />
    </main>
  );
}
