import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { startOfWeek } from "@/lib/format";
import { DEFAULT_PLAN, planRoutines } from "@/lib/plan";
import { nextRoutineKey } from "@/lib/progression";
import { WEEKLY_GOAL } from "@/lib/stats";
import RingsWidget from "../widgets/Rings";
import TodayWidget, { type TodayProps } from "../widgets/Today";
import { freshSession, getSnapshot, localFinished } from "./store";

/**
 * Fills the Home Screen / Lock Screen widgets (Today and Nutrition rings). Runs when the app opens, goes to the background
 * (e.g. after logging a meal) and after a workout. Workout info comes from the plan and history
 * on the phone; calories, protein and weight come from the database with the app's sign-in.
 * With no signal it keeps the last numbers it had.
 */

type Nutrition = Pick<TodayProps, "kcal" | "kcalTarget" | "protein" | "proteinTarget" | "weight" | "weightChange"> & { day: string };
const KEY = "nf.widget.nutrition.v1";

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

async function get<T>(path: string): Promise<T> {
  const s = await freshSession();
  if (!s) throw new Error("Not signed in yet");
  const res = await fetch(`${s.url}/rest/v1/${path}`, { headers: { apikey: s.anonKey, Authorization: `Bearer ${s.accessToken}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

async function fetchNutrition(dayStart: Date): Promise<Nutrition> {
  const from = encodeURIComponent(dayStart.toISOString());
  const to = encodeURIComponent(new Date(dayStart.getTime() + 86400e3).toISOString());
  const [meals, profile, weights] = await Promise.all([
    get<{ kcal: number; protein: number }[]>(`meals?select=kcal,protein&eaten_at=gte.${from}&eaten_at=lt.${to}`),
    // targets is added by 0005_widget.sql; without it the widget shows calories eaten instead of left.
    get<{ targets: { kcal: number; protein: number } | null }[]>("profiles?select=targets").catch(() => []),
    get<{ kg: number; measured_at: string }[]>("body_weights?select=kg,measured_at&order=measured_at.desc&limit=60"),
  ]);
  const t = profile[0]?.targets ?? null;
  const latest = weights[0];
  // Change over a week: latest weigh-in vs the last one at least 7 days before it.
  const weekBefore = latest && weights.find((w) => Date.parse(latest.measured_at) - Date.parse(w.measured_at) >= 7 * 86400e3 - 6 * 3600e3);
  return {
    day: dayKey(dayStart),
    kcal: Math.round(meals.reduce((n, m) => n + Number(m.kcal || 0), 0)),
    protein: Math.round(meals.reduce((n, m) => n + Number(m.protein || 0), 0)),
    kcalTarget: t?.kcal ? Math.round(t.kcal) : undefined,
    proteinTarget: t?.protein ? Math.round(t.protein) : undefined,
    weight: latest ? Math.round(Number(latest.kg) * 10) / 10 : undefined,
    weightChange: latest && weekBefore ? Math.round((Number(latest.kg) - Number(weekBefore.kg)) * 10) / 10 : undefined,
  };
}

async function build(now: Date): Promise<{ today: TodayProps; tomorrow: TodayProps; midnight: Date }> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const midnight = new Date(dayStart.getTime() + 86400e3 + 3600e3); // safe across daylight saving
  midnight.setHours(0, 0, 5, 0);

  let food: Nutrition | null = null;
  try {
    food = await fetchNutrition(dayStart);
    AsyncStorage.setItem(KEY, JSON.stringify(food)).catch(() => {});
  } catch {
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null") as Nutrition | null;
      // Yesterday's food doesn't count today, but targets and weight still do.
      food = saved && (saved.day === dayKey(dayStart) ? saved : { ...saved, kcal: 0, protein: 0 });
    } catch {}
  }

  const snap = await getSnapshot();
  const local = await localFinished();
  const ids = new Set(local.map((w) => w.id));
  const history = [...local, ...(snap?.history ?? []).filter((w) => w.finishedAt && !ids.has(w.id))];
  const routines = planRoutines(snap?.plan ?? DEFAULT_PLAN);
  const nextKey = nextRoutineKey(history);
  const workout = (routines.find((r) => r.key === nextKey) ?? routines[0])?.name;
  const finishedSince = (d: Date) => history.filter((w) => Date.parse(w.finishedAt!) >= d.getTime()).length;

  const today: TodayProps = {
    workout,
    trainedToday: finishedSince(dayStart) > 0,
    sessions: finishedSince(startOfWeek(now)),
    sessionGoal: WEEKLY_GOAL,
    kcal: food?.kcal ?? 0,
    kcalTarget: food?.kcalTarget,
    protein: food?.protein ?? 0,
    proteinTarget: food?.proteinTarget,
    weight: food?.weight,
    weightChange: food?.weightChange,
    ready: Boolean(snap || food),
  };
  const newWeek = startOfWeek(midnight).getTime() !== startOfWeek(now).getTime();
  const tomorrow: TodayProps = { ...today, trainedToday: false, kcal: 0, protein: 0, sessions: newWeek ? 0 : today.sessions };
  return { today, tomorrow, midnight };
}

let running: Promise<void> | null = null;
let again = false;

/** Refresh the widget now. Safe to call often: overlapping calls collapse into one more run. */
export function refreshWidget(): void {
  if (Platform.OS !== "ios") return;
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    try {
      const { today, tomorrow, midnight } = await build(new Date());
      // Show today's numbers now, and reset calories at midnight even if the app isn't opened.
      // iOS stores widget data as a property list, which can't hold null or undefined: drop empty fields.
      const plain = (x: TodayProps) => Object.fromEntries(Object.entries(x).filter(([, v]) => v != null)) as TodayProps;
      const entries = [
        { date: new Date(), props: plain(today) },
        { date: midnight, props: plain(tomorrow) },
      ];
      TodayWidget.updateTimeline(entries);
      RingsWidget.updateTimeline(entries);
    } catch {
      // The widget keeps what it showed last.
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      refreshWidget();
    }
  });
}
