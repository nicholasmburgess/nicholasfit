"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { foodStore } from "@/lib/food-store";
import { currentWeight, dailyTargets, dayRange, dayTotals } from "@/lib/nutrition";

/** One-line food summary for the Today page. Stays hidden if food tracking isn't set up. */
export function FoodToday() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const { start, end } = dayRange(0);
    Promise.all([foodStore.listMeals(start.toISOString(), end.toISOString()), foodStore.getProfile(), foodStore.listWeights()])
      .then(([meals, profile, weights]) => {
        const t = dayTotals(meals);
        const w = currentWeight(weights);
        if (profile && w) {
          const g = dailyTargets(profile, w.kg);
          setLine(`${Math.round(t.kcal).toLocaleString("en-AU")} / ${g.kcal.toLocaleString("en-AU")} kcal · ${Math.round(t.protein)} / ${g.protein} g protein`);
        } else setLine(meals.length ? `${Math.round(t.kcal)} kcal · ${Math.round(t.protein)} g protein` : "Set up your targets");
      })
      .catch(() => setLine(null));
  }, []);
  if (line === null) return null;
  return (
    <Link href="/food" className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
      <span>
        <span className="block font-semibold">Food today</span>
        <span className="text-sm text-muted">{line}</span>
      </span>
      <span className="text-accent">›</span>
    </Link>
  );
}
