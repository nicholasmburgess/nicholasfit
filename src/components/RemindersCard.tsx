"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { hasNativeWorkout } from "@/lib/native";
import type { ReminderSettings } from "@/lib/reminders";
import { getReminderSettings, saveReminderSettings } from "@/lib/reminders-web";

const ROWS: { key: keyof ReminderSettings; label: string; detail: string }[] = [
  { key: "train", label: "Training", detail: "5:30 pm when it's been 2 days since a strength session" },
  { key: "weigh", label: "Weigh-in", detail: "7:30 am, skipped once you've weighed in" },
  { key: "meals", label: "Food log", detail: "8 pm when today looks part-logged" },
  { key: "review", label: "Weekly review", detail: "Monday 8 am" },
  { key: "waist", label: "Waist", detail: "Sunday 8 am, for the recomp check" },
];

/** Reminder switches (iPhone app only). The app-expiry warning is always on. */
export function RemindersCard() {
  const [s, setS] = useState<ReminderSettings | null>(null);
  useEffect(() => {
    if (hasNativeWorkout()) setS(getReminderSettings());
  }, []);
  if (!s) return null;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">Reminders</h2>
      <ul className="divide-y divide-line">
        {ROWS.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs text-muted">{r.detail}</span>
            </span>
            <button
              role="switch"
              aria-checked={s[r.key]}
              aria-label={r.label}
              onClick={() => {
                const next = { ...s, [r.key]: !s[r.key] };
                setS(next);
                saveReminderSettings(next);
              }}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${s[r.key] ? "bg-accent" : "bg-card-2 border border-line"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${s[r.key] ? "left-[1.375rem]" : "left-0.5"}`} />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">You&apos;ll also get a warning a day before the iPhone app&apos;s 7-day install runs out.</p>
    </Card>
  );
}
