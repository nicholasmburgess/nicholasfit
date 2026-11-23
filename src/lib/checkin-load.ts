import { checkinRange, weeklyCheckin, type Checkin } from "./checkin";
import { foodStore } from "./food-store";
import type { Profile, WeightEntry } from "./types";

/** Fetches what the weekly check-in needs (meals in its window, diet start, waist) and runs it. */
export async function loadCheckin(profile: Profile, weights: WeightEntry[]): Promise<Checkin> {
  const { start, end } = checkinRange();
  const [meals, dietStart, waist] = await Promise.all([
    foodStore.listMeals(start.toISOString(), end.toISOString()),
    foodStore.firstMealAt().catch(() => null),
    foodStore.listMeasurements().catch(() => []),
  ]);
  return weeklyCheckin(profile, weights, meals, { dietStart, waist });
}
