/**
 * Local reminders for the iPhone app. The site works out what's due (it has the data) and the phone
 * schedules them as notifications for the next 7 days, replacing the set each time the app opens, so
 * a reminder you've already acted on (weighed in, trained) is dropped. Pure: shared with the iPhone app.
 */

export type ReminderSettings = {
  /** Late afternoon nudge when it's been two days since a strength session. */
  train: boolean;
  /** Morning weigh-in. */
  weigh: boolean;
  /** Evening "log today's food" when the day looks part-logged. */
  meals: boolean;
  /** Monday morning: the weekly review is ready. */
  review: boolean;
  /** Sunday morning: measure your waist (the check-in needs it to spot a recomp). */
  waist: boolean;
};

export const DEFAULT_REMINDERS: ReminderSettings = { train: true, weigh: true, meals: true, review: true, waist: true };

export type ReminderContext = {
  lastStrengthAt: string | null;
  weighedToday: boolean;
  kcalToday: number;
  /** A typical full day's logged calories, to judge whether today looks complete. */
  typicalKcal: number | null;
  waistThisWeek: boolean;
};

export type Reminder = { id: string; title: string; body: string; at: string };

const at = (base: Date, days: number, h: number, m = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
};

export function planReminders(s: ReminderSettings, c: ReminderContext, now = new Date(), expiresAt?: string | null): Reminder[] {
  const out: Reminder[] = [];
  const add = (id: string, when: Date, title: string, body: string) => {
    if (when.getTime() > now.getTime() + 60e3) out.push({ id, title, body, at: when.toISOString() });
  };
  for (let d = 0; d < 7; d++) {
    if (s.weigh && !(d === 0 && c.weighedToday)) add(`weigh-${d}`, at(now, d, 7, 30), "Weigh in", "Step on the scale before breakfast. It syncs from Withings.");
    if (s.meals) {
      const done = d === 0 && c.typicalKcal != null && c.kcalToday >= c.typicalKcal * 0.7;
      if (!done) add(`meals-${d}`, at(now, d, 20), "Log today's food", d === 0 && c.kcalToday > 0 ? "Today looks part-logged. A photo or a few words is enough." : "A photo or a few words is enough.");
    }
    const day = at(now, d, 0).getDay();
    if (s.review && day === 1) add(`review-${d}`, at(now, d, 8), "Weekly review", "Your weekly review is ready on the Today page.");
    if (s.waist && day === 0 && !(d === 0 && c.waistThisWeek)) add(`waist-${d}`, at(now, d, 8), "Measure your waist", "Tape at your belly button, relaxed, after breathing out.");
  }
  if (s.train) {
    // Every second day from two days after the last session (re-planned whenever the app opens).
    const last = c.lastStrengthAt ? at(new Date(c.lastStrengthAt), 0, 0) : at(now, -2, 0);
    for (let d = 0, n = 0; d < 7 && n < 3; d++) {
      const day = at(now, d, 0);
      const gap = Math.round((day.getTime() - last.getTime()) / 86400e3);
      if (gap >= 2 && gap % 2 === 0) {
        add(`train-${d}`, at(now, d, 17, 30), "Time to train", gap > 2 ? `${gap} days since your last strength session. 45 minutes is enough.` : "Your next strength session is due today.");
        n++;
      }
    }
  }
  if (expiresAt) {
    const exp = Date.parse(expiresAt);
    const body = "Reinstall it from your Mac (about 2 minutes). Your data is kept.";
    add("expiry-24h", new Date(exp - 24 * 3600e3), "The iPhone app expires tomorrow", body);
    add("expiry-2h", new Date(exp - 2 * 3600e3), "The iPhone app expires in 2 hours", body);
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
