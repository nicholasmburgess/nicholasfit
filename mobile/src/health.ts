import {
  CategoryValueSleepAnalysis,
  authorizationStatusFor,
  WorkoutActivityType,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  saveWorkoutSample,
} from "@kingstinct/react-native-healthkit";
import { activeKcal } from "@/lib/row";
import type { RowPiece } from "@/lib/types";
import type { HrSample } from "./heartRate";

const READ = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierHeartRate",
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKWorkoutTypeIdentifier",
] as const;
const SHARE = ["HKWorkoutTypeIdentifier", "HKQuantityTypeIdentifierHeartRate", "HKQuantityTypeIdentifierActiveEnergyBurned"] as const;

/** One calendar day (phone's time zone) of recovery and activity data. Missing values are null. */
export type HealthDay = {
  day: string;
  steps: number | null;
  activeKcal: number | null;
  restingHr: number | null;
  hrvMs: number | null;
  sleepMin: number | null;
};

/** Cardio sessions other apps saved to Apple Health, e.g. Concept2 ErgData rows. */
export type HealthWorkout = {
  id: string;
  activity: "rowing" | "other";
  startedAt: string;
  minutes: number;
  distanceM: number | null;
  kcal: number | null;
  source: string | null;
};

export const healthAvailable = () => {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
};

/** Shows Apple's permission sheet the first time; afterwards it returns straight away. */
export async function authorize() {
  return requestAuthorization({ toRead: READ, toShare: SHARE });
}

const localDay = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function midnight(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

async function daily(
  id: (typeof READ)[number] & `HKQuantityTypeIdentifier${string}`,
  stat: "cumulativeSum" | "discreteAverage",
  unit: string,
  start: Date,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const rows = await queryStatisticsCollectionForQuantity(id, [stat], start, { day: 1 }, { filter: { date: { startDate: start, endDate: new Date() } }, unit } as never);
  for (const r of rows) {
    const q = stat === "cumulativeSum" ? r.sumQuantity : r.averageQuantity;
    if (r.startDate && q && Number.isFinite(q.quantity)) out.set(localDay(new Date(r.startDate)), q.quantity);
  }
  return out;
}

/** Minutes asleep per night, credited to the day the night ends. Overlapping sources are merged. */
async function sleepByDay(start: Date): Promise<Map<string, number>> {
  const asleep = new Set<number>([CategoryValueSleepAnalysis.asleepUnspecified, CategoryValueSleepAnalysis.asleepCore, CategoryValueSleepAnalysis.asleepDeep, CategoryValueSleepAnalysis.asleepREM]);
  const samples = await queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
    limit: 0,
    ascending: true,
    filter: { date: { startDate: new Date(start.getTime() - 12 * 3600e3), endDate: new Date() } },
  });
  const spans = samples
    .filter((s) => asleep.has(Number(s.value)))
    .map((s) => [new Date(s.startDate).getTime(), new Date(s.endDate).getTime()] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  const out = new Map<string, number>();
  for (const [a, b] of merged) {
    // Sleep ending before 6 pm counts toward that day; a nap later in the evening counts toward the next.
    const end = new Date(b);
    const key = localDay(end.getHours() >= 18 ? new Date(b + 12 * 3600e3) : end);
    out.set(key, (out.get(key) ?? 0) + (b - a) / 60000);
  }
  return out;
}

/** Last `days` days of recovery data plus cardio workouts from other apps. */
export async function readHealth(days = 14): Promise<{ days: HealthDay[]; workouts: HealthWorkout[] }> {
  const start = midnight(days - 1);
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const empty = new Map<string, number>();
  const [steps, kcal, rhr, hrv, sleep, workouts] = await Promise.all([
    safe(daily("HKQuantityTypeIdentifierStepCount", "cumulativeSum", "count", start), empty),
    safe(daily("HKQuantityTypeIdentifierActiveEnergyBurned", "cumulativeSum", "kcal", start), empty),
    safe(daily("HKQuantityTypeIdentifierRestingHeartRate", "discreteAverage", "count/min", start), empty),
    safe(daily("HKQuantityTypeIdentifierHeartRateVariabilitySDNN", "discreteAverage", "ms", start), empty),
    safe(sleepByDay(start), empty),
    safe(queryWorkoutSamples({ limit: 0, ascending: false, filter: { date: { startDate: start, endDate: new Date() } } }), []),
  ]);

  const round = (v: number | undefined, dp = 0) => (v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp);
  const out: HealthDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDay(midnight(i));
    out.push({
      day,
      steps: round(steps.get(day)),
      activeKcal: round(kcal.get(day)),
      restingHr: round(rhr.get(day)),
      hrvMs: round(hrv.get(day)),
      sleepMin: round(sleep.get(day)),
    });
  }

  const cardio: HealthWorkout[] = [];
  for (const w of workouts) {
    const json = w.toJSON();
    const source = json.sourceRevision?.source?.name ?? null;
    // Skip the strength sessions this app saved itself.
    if (json.sourceRevision?.source?.bundleIdentifier === "com.nicholasmburgess.nicholasfit") continue;
    const isRow = json.workoutActivityType === WorkoutActivityType.rowing;
    if (!isRow) continue;
    cardio.push({
      id: json.uuid,
      activity: "rowing",
      startedAt: new Date(json.startDate).toISOString(),
      minutes: Math.round(((new Date(json.endDate).getTime() - new Date(json.startDate).getTime()) / 60000) * 10) / 10,
      distanceM: json.totalDistance ? Math.round(json.totalDistance.quantity * (json.totalDistance.unit === "km" ? 1000 : 1)) : null,
      kcal: json.totalEnergyBurned ? Math.round(json.totalEnergyBurned.quantity) : null,
      source,
    });
    w.dispose?.();
  }
  return { days: out, workouts: cardio };
}

/** Saves a finished strength session (and the strap's heart rate, if any) to Apple Health. */
export async function saveStrengthWorkout(w: { id: string; name: string; startedAt: string; finishedAt: string }, hr: HrSample[]) {
  const start = new Date(w.startedAt);
  const end = new Date(w.finishedAt);
  const quantities = hr.map((s) => ({
    quantityType: "HKQuantityTypeIdentifierHeartRate" as const,
    unit: "count/min",
    quantity: s.bpm,
    startDate: new Date(s.at),
    endDate: new Date(s.at),
  }));
  await saveWorkoutSample(WorkoutActivityType.traditionalStrengthTraining, quantities, start, end, undefined, {
    HKExternalUUID: w.id,
    HKWorkoutBrandName: "Nicholasfit",
    name: w.name,
  });
  const bpms = hr.map((s) => s.bpm);
  return bpms.length ? { avgHr: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length), maxHr: Math.max(...bpms) } : { avgHr: null, maxHr: null };
}

/**
 * Saves a rowing session logged live from the PM5: distance, active calories and heart rate.
 * Calorie samples are only added when Health allows them, so a switched-off permission can't fail the save.
 */
export async function saveRowingWorkout(w: { id: string; name: string; startedAt: string; finishedAt: string }, rows: RowPiece[], hr: HrSample[]) {
  const start = new Date(w.startedAt);
  const end = new Date(w.finishedAt);
  const distance = rows.reduce((a, r) => a + r.distanceM, 0);
  const kcal = rows.reduce((a, r) => a + (activeKcal(r) ?? 0), 0);
  const heart = hr.map((s) => ({
    quantityType: "HKQuantityTypeIdentifierHeartRate" as const,
    unit: "count/min",
    quantity: s.bpm,
    startDate: new Date(s.at),
    endDate: new Date(s.at),
  }));
  // One calorie sample per piece, so Apple's Activity rings count the row.
  const energy = rows
    .filter((r) => (activeKcal(r) ?? 0) > 0)
    .map((r) => ({
      quantityType: "HKQuantityTypeIdentifierActiveEnergyBurned" as const,
      unit: "kcal",
      quantity: activeKcal(r)!,
      startDate: new Date(r.startedAt),
      endDate: new Date(Math.min(Date.parse(r.startedAt) + r.seconds * 1000, end.getTime())),
    }));
  const metadata = { HKExternalUUID: w.id, HKWorkoutBrandName: "Nicholasfit", HKIndoorWorkout: true, name: w.name };
  const totals = { distance: distance || undefined, energyBurned: kcal || undefined };
  let energyOk = false;
  try {
    energyOk = Number(authorizationStatusFor("HKQuantityTypeIdentifierActiveEnergyBurned")) === 2; // sharingAuthorized
  } catch {
    energyOk = false;
  }
  await saveWorkoutSample(WorkoutActivityType.rowing, energyOk ? [...heart, ...energy] : heart, start, end, totals, metadata);
  const bpms = hr.map((s) => s.bpm);
  return bpms.length ? { avgHr: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length), maxHr: Math.max(...bpms) } : { avgHr: null, maxHr: null };
}
