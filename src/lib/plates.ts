export const BAR_KG = 20;
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Plates for one side of a 20 kg bar, heaviest first. Null when the weight can't be made exactly. */
export function platesPerSide(totalKg: number, bar = BAR_KG): number[] | null {
  let side = (totalKg - bar) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of PLATES) {
    while (side >= p - 1e-9) {
      out.push(p);
      side -= p;
    }
  }
  return side > 1e-9 ? null : out;
}

export function describePlates(totalKg: number): string {
  if (totalKg < BAR_KG) return `Less than the ${BAR_KG} kg bar`;
  if (totalKg === BAR_KG) return "Empty bar";
  const plates = platesPerSide(totalKg);
  if (!plates) return `Can't make ${totalKg} kg exactly with standard plates`;
  return `Each side: ${plates.join(" + ")}`;
}

/**
 * Warm-up sets before a barbell working weight: empty bar, then about 50% and 75%,
 * rounded to the nearest 5 kg (2.5 kg plates each side). Fewer steps for lighter weights.
 */
export function warmupSets(workKg: number): { kg: number; reps: number }[] {
  if (workKg < 40) return workKg > BAR_KG ? [{ kg: BAR_KG, reps: 10 }] : [];
  const r = (x: number) => Math.max(BAR_KG, Math.round(x / 5) * 5);
  const steps = [{ kg: BAR_KG, reps: 10 }, { kg: r(workKg * 0.5), reps: 5 }];
  if (workKg >= 60) steps.push({ kg: r(workKg * 0.75), reps: 3 });
  return steps.filter((s, i, a) => s.kg < workKg && (i === 0 || s.kg > a[i - 1].kg));
}
