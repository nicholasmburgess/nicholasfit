import type { Meal, Profile, WeightEntry } from "./types";

export type Targets = { kcal: number; protein: number; tdee: number };

const round = (n: number, to: number) => Math.round(n / to) * to;

/**
 * Daily targets for losing fat while building muscle. Sources are listed in SOURCES (shown in the app).
 * - Resting energy: Mifflin-St Jeor, the most accurate prediction equation in systematic review (Frankenfield 2005).
 * - x 1.45 activity (desk job + 3 strength sessions a week, "low active" in FAO/WHO/UNU 2004).
 * - Minus 20%, at most 500 kcal: about 0.5 kg a week, the 0.5-1% of body weight per week that best keeps muscle (Helms 2014).
 *   Never below 1,500 kcal (men) / 1,200 kcal (women).
 * - Protein 2.0 g/kg: above the 1.6 g/kg where gains plateau (Morton 2018), higher in a deficit (Helms 2014, ISSN 2017).
 *   Uses the weight at BMI 25 as a ceiling, so it scales with lean mass rather than total weight at higher body fat.
 */
export function dailyTargets(p: Profile, kg: number, now = new Date()): Targets {
  const age = now.getFullYear() - p.birthYear;
  const bmr = 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === "male" ? 5 : -161);
  const tdee = bmr * 1.45;
  const kcal = Math.max(tdee - Math.min(tdee * 0.2, 500), p.sex === "male" ? 1500 : 1200);
  const refKg = 25 * (p.heightCm / 100) ** 2;
  return { kcal: round(kcal, 50), protein: round(2 * Math.min(kg, refKg), 5), tdee: round(tdee, 50) };
}

export function dayTotals(meals: Meal[]) {
  return meals.reduce(
    (t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Local-midnight bounds for the day `offset` days from today. */
export function dayRange(offset = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export const SOURCES = [
  {
    text: "Frankenfield D et al. Comparison of predictive equations for resting metabolic rate in healthy nonobese and obese adults: a systematic review. J Am Diet Assoc, 2005.",
    url: "https://pubmed.ncbi.nlm.nih.gov/15883556/",
  },
  { text: "FAO/WHO/UNU. Human energy requirements (physical activity levels). 2004.", url: "https://www.fao.org/4/y5686e/y5686e00.htm" },
  {
    text: "Helms ER et al. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr, 2014.",
    url: "https://pubmed.ncbi.nlm.nih.gov/24864135/",
  },
  {
    text: "Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. Br J Sports Med, 2018.",
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
  },
  { text: "Jäger R et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr, 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
];

/** Average of weigh-ins in the 7 days up to the latest one, which smooths out day-to-day water swings. */
export function currentWeight(weights: WeightEntry[]): { kg: number; date: string; count: number } | null {
  const last = weights.at(-1);
  if (!last) return null;
  const from = Date.parse(last.measuredAt) - 7 * 86400000;
  const recent = weights.filter((w) => Date.parse(w.measuredAt) > from);
  const kg = recent.reduce((s, w) => s + w.kg, 0) / recent.length;
  return { kg: Math.round(kg * 10) / 10, date: last.measuredAt, count: recent.length };
}
