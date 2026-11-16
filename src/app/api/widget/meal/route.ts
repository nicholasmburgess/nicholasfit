import { NextResponse } from "next/server";
import { estimateMeal } from "@/lib/server/estimate";
import { anonSupabase, guard, widgetError } from "@/lib/server/widget";

export const maxDuration = 60;

type Saved = { description?: string; items?: unknown[]; kcal?: number; protein?: number; carbs?: number; fat?: number; confidence?: string };

/**
 * POST { description?, image? }  -> estimate (nothing saved)
 * POST { save: { description, items, kcal, protein, carbs, fat, confidence } } -> logs the meal now
 */
export async function POST(req: Request) {
  const token = guard(req);
  if (typeof token !== "string") return token;
  const body = (await req.json().catch(() => null)) as ({ description?: string; image?: string; save?: Saved } | null);
  const db = anonSupabase();

  if (body?.save) {
    const s = body.save;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 20000 ? Math.round(v) : 0);
    const { error } = await db.rpc("widget_add_meal", {
      p_token: token,
      p_meal: {
        description: String(s.description ?? "").slice(0, 500),
        items: Array.isArray(s.items) ? s.items.slice(0, 30) : [],
        kcal: n(s.kcal), protein: n(s.protein), carbs: n(s.carbs), fat: n(s.fat),
        confidence: ["low", "medium", "high"].includes(String(s.confidence)) ? s.confidence : null,
      },
    });
    return error ? widgetError(error) : NextResponse.json({ ok: true });
  }

  // Check the key before spending a Claude call on it.
  const { error } = await db.rpc("widget_summary", { p_token: token, p_day_start: new Date().toISOString(), p_week_start: new Date().toISOString() });
  if (error) return widgetError(error);
  const r = await estimateMeal(body);
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status });
}
