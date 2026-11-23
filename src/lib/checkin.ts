import { startOfWeek } from "./format";
import { dailyTargets, deficit, type Targets } from "./nutrition";
import type { Meal, Measurement, Profile, WeightEntry } from "./types";

/**
 * Energy in 1 kg of body-mass change during a diet. The old 7,700 kcal/kg rule assumes pure fat; measured
 * values are lower because part of the loss is water, glycogen and lean tissue: about 4,900 kcal/kg at
 * week 4, levelling off near 6,000 from week 6 (Heymsfield 2012, CALERIE). With the first weeks skipped
 * (SETTLE_DAYS), 6,000 is the better fit.
 */
const KCAL_PER_KG = 6000;
/** Early weight loss is mostly water and glycogen, so the first two weeks of logging are left out. */
const SETTLE_DAYS = 14;
const WINDOW_DAYS = 21;
/** A day counts as logged only when it looks complete, so a forgotten dinner doesn't drag the average down. */
const MIN_DAY_KCAL = 1000;
const MIN_LOGGED_DAYS = 10;
const MIN_WEIGH_INS = 6;

export type Checkin =
  | { ready: false; loggedDays: number; weighIns: number; needDays: number; needWeighIns: number; settlingUntil: Date | null }
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
      verdict: "fast" | "on-track" | "recomp" | "slow" | "gaining";
      /** Waist trend over the window, when there are enough measurements. */
      waistCmPerWeek: number | null;
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
export function weeklyCheckin(
  profile: Profile,
  weights: WeightEntry[],
  meals: Meal[],
  opts: { dietStart?: string | null; waist?: Measurement[] } = {},
  now = new Date(),
): Checkin {
  const end = startOfWeek(now);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  // Skip the settling weeks at the start of the diet.
  const settled = opts.dietStart ? new Date(Date.parse(opts.dietStart) + SETTLE_DAYS * 86400000) : null;
  if (settled && settled > start) start.setTime(settled.getTime());
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
      settlingUntil: settled && settled > now ? settled : null,
    };
  }

  const avgIntake = logged.reduce((s, k) => s + k, 0) / logged.length;
  const kgPerDay = slopePerDay(ws.map((w) => ({ t: Date.parse(w.measuredAt) / 86400000, kg: w.kg })));
  const currentKg = ws.slice(-7).reduce((s, w) => s + w.kg, 0) / Math.min(7, ws.length);
  const formula = dailyTargets(profile, currentKg, now);
  // Energy balance, kept within ±25% of the formula so one odd fortnight can't swing it wildly.
  const observed = avgIntake - kgPerDay * KCAL_PER_KG;
  const maintenance = round(Math.min(formula.tdee * 1.25, Math.max(formula.tdee * 0.75, observed)), 50);
  const floor = profile.sex === "male" ? 1500 : 1200;

  const kgPerWeek = kgPerDay * 7;
  const pctPerWeek = (kgPerWeek / currentKg) * 100;

  // Waist trend: a shrinking waist with flat weight means fat is going and muscle is coming (a recomp).
  const waistFrom = start.getTime() - 7 * 86400000;
  const wm = (opts.waist ?? []).filter((m) => m.kind === "waist" && Date.parse(m.measuredAt) >= waistFrom && Date.parse(m.measuredAt) < end.getTime());
  const waistSpanDays = wm.length >= 2 ? (Date.parse(wm[wm.length - 1].measuredAt) - Date.parse(wm[0].measuredAt)) / 86400000 : 0;
  const waistCmPerWeek = waistSpanDays >= 10 ? Math.round(slopePerDay(wm.map((m) => ({ t: Date.parse(m.measuredAt) / 86400000, kg: m.cm }))) * 7 * 10) / 10 : null;

  const flat = pctPerWeek > -0.15 && pctPerWeek <= 0.15;
  const verdict =
    pctPerWeek < -0.75 ? "fast" : pctPerWeek <= -0.15 ? "on-track" : flat && waistCmPerWeek != null && waistCmPerWeek <= -0.2 ? "recomp" : pctPerWeek <= 0.15 ? "slow" : "gaining";
  // A recomp that's working keeps the calories you've been eating, rather than cutting further.
  const kcal = round(Math.max(verdict === "recomp" ? Math.min(avgIntake, maintenance) : maintenance - deficit(maintenance), floor), 50);
  const advice = {
    fast: "You're losing faster than 0.75% a week, which risks muscle. Your target has gone up to slow it down.",
    "on-track": "You're losing at a muscle-friendly pace. Keep going.",
    recomp: "Weight is flat but your waist is shrinking: you're losing fat and building muscle. Your target stays at what you've been eating.",
    slow: "Weight is about flat. Your target is now set from your real maintenance, so expect it to start moving. Measure your waist weekly so the check-in can tell if you're recomping.",
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
    waistCmPerWeek,
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
