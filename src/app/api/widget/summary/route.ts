import { NextResponse } from "next/server";
import { WEEKLY_GOAL } from "@/lib/stats";
import { anonSupabase, guard, widgetError } from "@/lib/server/widget";

export const dynamic = "force-dynamic";

const iso = (v: string | null, fallback: Date) => {
  const d = v ? new Date(v) : fallback;
  return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
};

/** GET ?day=<local midnight ISO>&week=<local Monday ISO> -> today's totals for the widget. */
export async function GET(req: Request) {
  const token = guard(req);
  if (typeof token !== "string") return token;
  const url = new URL(req.url);
  const now = new Date();
  const { data, error } = await anonSupabase().rpc("widget_summary", {
    p_token: token,
    p_day_start: iso(url.searchParams.get("day"), new Date(now.getTime() - 86400e3)),
    p_week_start: iso(url.searchParams.get("week"), new Date(now.getTime() - 7 * 86400e3)),
  });
  if (error) return widgetError(error);
  const d = data as { kcal: number; protein: number; targets: { kcal: number; protein: number } | null; sessions: number; weight: number | null };
  return NextResponse.json({
    kcal: Math.round(Number(d.kcal)),
    protein: Math.round(Number(d.protein)),
    targets: d.targets,
    sessions: Number(d.sessions),
    sessionGoal: WEEKLY_GOAL,
    weight: d.weight == null ? null : Math.round(Number(d.weight) * 10) / 10,
  });
}
