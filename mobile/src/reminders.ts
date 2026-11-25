import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { DEFAULT_REMINDERS, planReminders, type ReminderContext, type ReminderSettings } from "@/lib/reminders";
import { expiresAt } from "./expiry";

const KEY = "nf.reminders.v1";
const PREFIX = "nf-rem-";

type Saved = { settings: ReminderSettings; context: ReminderContext };

/**
 * Replace this app's scheduled reminders with a fresh set for the next 7 days. Called with what the site sends
 * (settings and today's data) and on launch with the last copy, so the expiry warning is always set.
 */
export async function scheduleReminders(next?: Saved): Promise<void> {
  try {
    if (next) await AsyncStorage.setItem(KEY, JSON.stringify(next));
    const saved: Saved = next ?? JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null") ?? {
      settings: { ...DEFAULT_REMINDERS, train: false, weigh: false, meals: false, review: false, waist: false },
      context: { lastStrengthAt: null, weighedToday: false, kcalToday: 0, typicalKcal: null, waistThisWeek: false },
    };
    const list = planReminders(saved.settings, saved.context, new Date(), expiresAt());
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      if (!list.length || !perm.canAskAgain) return;
      const asked = await Notifications.requestPermissionsAsync();
      if (!asked.granted) return;
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    for (const r of list)
      await Notifications.scheduleNotificationAsync({
        identifier: PREFIX + r.id,
        content: { title: r.title, body: r.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
      }).catch(() => {});
  } catch {
    // Notifications not allowed or storage unavailable: nothing to schedule.
  }
}
