/** Open Food Facts lookup. Called from the phone (the server can't reach it), with no key needed. */

export type Product = {
  code: string;
  name: string;
  /** Nutrients per 100 g (or ml). */
  per100: { kcal: number; protein: number; carbs: number; fat: number };
  /** Grams in one serving, if the label gives it. */
  servingG: number | null;
  servingLabel: string | null;
};

type Nutriments = Record<string, number | string | undefined>;

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);

export function parseProduct(code: string, json: unknown): Product | null {
  const j = json as { status?: number; product?: Record<string, unknown> };
  const p = j?.product;
  if (!p || j.status === 0) return null;
  const n = (p.nutriments ?? {}) as Nutriments;
  let kcal = num(n["energy-kcal_100g"]);
  if (!Number.isFinite(kcal)) {
    const kj = num(n["energy-kj_100g"] ?? n["energy_100g"]);
    kcal = Number.isFinite(kj) ? kj / 4.184 : NaN;
  }
  if (!Number.isFinite(kcal)) return null;
  const g = (k: string) => {
    const v = num(n[`${k}_100g`]);
    return Number.isFinite(v) ? v : 0;
  };
  const brand = typeof p.brands === "string" ? p.brands.split(",")[0].trim() : "";
  const base = (typeof p.product_name === "string" && p.product_name.trim()) || "Scanned product";
  const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base;
  const sq = num(p.serving_quantity);
  return {
    code,
    name,
    per100: { kcal, protein: g("proteins"), carbs: g("carbohydrates"), fat: g("fat") },
    servingG: Number.isFinite(sq) && sq > 0 ? sq : null,
    servingLabel: typeof p.serving_size === "string" && p.serving_size.trim() ? p.serving_size.trim() : null,
  };
}

export async function lookupBarcode(code: string): Promise<Product | null> {
  const fields = "product_name,brands,nutriments,serving_size,serving_quantity";
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Couldn't reach Open Food Facts");
  return parseProduct(code, await res.json());
}

/** Nutrients for a given number of grams. */
export function forGrams(p: Product, grams: number) {
  const f = grams / 100;
  return {
    kcal: Math.round(p.per100.kcal * f),
    protein: Math.round(p.per100.protein * f * 10) / 10,
    carbs: Math.round(p.per100.carbs * f * 10) / 10,
    fat: Math.round(p.per100.fat * f * 10) / 10,
  };
}
