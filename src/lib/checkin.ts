import { startOfWeek } from "./format";
import { dailyTargets, type Targets } from "./nutrition";
import type { Meal, Profile, WeightEntry } from "./types";

/** Energy in 1 kg of body-mass change, mostly fat (the standard 7,700 kcal/kg approximation). */
const KCAL_PER_KG = 7700;
const WINDOW_DAYS = 21;
/** A day counts as logged only when it looks complete, so a forgotten dinner doesn't drag the average down. */
const MIN_DAY_KCAL = 1000;
const MIN_LOGGED_DAYS = 10;
const MIN_WEIGH_INS = 6;

export type Checkin =
  | { ready: false; loggedDays: number; weighIns: number; needDays: number; needWeighIns: number }
  | {
      ready: true;
      weekOf: Date;
      avgIntake: number;
      loggedDays: number;
      weighIns: number;
      /** Trend from a least-squares line through the window's weigh-ins. */
      kgPerWeek: number;
      pctPerWeek: number;
      maintenance: number;
      formulaMaintenance: number;
      targets: Targets;
      verdict: "fast" | "on-track" | "slow" | "gaining";
      advice: string;
    };

function slopePerDay(points: { t: number; kg: number }[]): number {
  const n = points.length;
  const mt = points.reduce((s, p) => s + p.t, 0) / n;
  const mk = points.reduce((s, p) => s + p.kg, 0) / n;
  const num = points.reduce((s, p) => s + (p.t - mt) * (p.kg - mk), 0);
  const den = points.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const round = (n: number, to: number) => Math.round(n / to) * to;

/**
 * Weekly check-in, fixed for the week (uses the 3 weeks before this Monday).
 * Estimates real maintenance from logged intake and the weight trend (energy balance),
 * the same idea as adaptive-expenditure apps. Because it's calibrated against what you
 * log, consistent under-logging (photos tend to run low) is corrected automatically.
 */
export function weeklyCheckin(profile: Profile, weights: WeightEntry[], meals: Meal[], now = new Date()): Checkin {
  const end = startOfWeek(now);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  const inWindow = (iso: string) => {
    const t = Date.parse(iso);
    return t >= start.getTime() && t < end.getTime();
  };

  const byDay = new Map<string, number>();
  for (const m of meals.filter((m) => inWindow(m.eatenAt))) byDay.set(dayKey(m.eatenAt), (byDay.get(dayKey(m.eatenAt)) ?? 0) + m.kcal);
  const logged = [...byDay.values()].filter((k) => k >= MIN_DAY_KCAL);
  const ws = weights.filter((w) => inWindow(w.measuredAt));

  if (logged.length < MIN_LOGGED_DAYS || ws.length < MIN_WEIGH_INS) {
    return {
      ready: false,
      loggedDays: logged.length,
      weighIns: ws.length,
      needDays: Math.max(0, MIN_LOGGED_DAYS - logged.length),
      needWeighIns: Math.max(0, MIN_WEIGH_INS - ws.length),
    };
  }

  const avgIntake = logged.reduce((s, k) => s + k, 0) / logged.length;
  const kgPerDay = slopePerDay(ws.map((w) => ({ t: Date.parse(w.measuredAt) / 86400000, kg: w.kg })));
  const currentKg = ws.slice(-7).reduce((s, w) => s + w.kg, 0) / Math.min(7, ws.length);
  const formula = dailyTargets(profile, currentKg, now);
  // Energy balance, kept within ±25% of the formula so one odd fortnight can't swing it wildly.
  const observed = avgIntake - kgPerDay * KCAL_PER_KG;
  const maintenance = round(Math.min(formula.tdee * 1.25, Math.max(formula.tdee * 0.75, observed)), 50);
  const kcal = round(Math.max(maintenance - Math.min(maintenance * 0.2, 500), profile.sex === "male" ? 1500 : 1200), 50);

  const kgPerWeek = kgPerDay * 7;
  const pctPerWeek = (kgPerWeek / currentKg) * 100;
  const verdict = pctPerWeek < -1 ? "fast" : pctPerWeek <= -0.25 ? "on-track" : pctPerWeek <= 0.1 ? "slow" : "gaining";
  const advice = {
    fast: "You're losing faster than 1% a week, which risks muscle. Your target has gone up to slow it down.",
    "on-track": "You're losing at a muscle-friendly pace. Keep going.",
    slow: "Weight is about flat. Your target is now set from your real maintenance, so expect it to start moving. If your waist is shrinking, that's a recomp working.",
    gaining: "Weight is trending up. Your target is now set from your real maintenance. Check that every meal is being logged.",
  }[verdict];

  return {
    ready: true,
    weekOf: end,
    avgIntake: Math.round(avgIntake),
    loggedDays: logged.length,
    weighIns: ws.length,
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    pctPerWeek: Math.round(pctPerWeek * 100) / 100,
    maintenance,
    formulaMaintenance: formula.tdee,
    targets: { kcal, protein: formula.protein, tdee: maintenance },
    verdict,
    advice,
  };
}

/** Meals needed for the check-in window. */
export function checkinRange(now = new Date()) {
  const end = startOfWeek(now);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { start, end };
}
