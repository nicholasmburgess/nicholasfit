"use client";

import { Card } from "@/components/Card";
import type { Checkin } from "@/lib/checkin";

export function CheckinCard({ c }: { c: Checkin }) {
  if (!c.ready)
    return (
      <Card className="space-y-1">
        <h2 className="font-semibold">Weekly check-in</h2>
        <p className="text-sm text-muted">
          After about two weeks of weigh-ins and food logging, your targets start adjusting to how your body actually responds. So far: {c.loggedDays} full days logged,{" "}
          {c.weighIns} weigh-ins
          {c.needDays + c.needWeighIns > 0 &&
            ` (need ${[c.needDays && `${c.needDays} more days`, c.needWeighIns && `${c.needWeighIns} more weigh-ins`].filter(Boolean).join(" and ")})`}
          .
        </p>
      </Card>
    );

  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const tone = c.verdict === "on-track" ? "text-accent" : "text-warn";
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Weekly check-in</h2>
        <span className="text-xs text-muted">week of {c.weekOf.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-card-2 px-2 py-2">
          <p className="text-lg font-semibold tabular-nums">{sign(c.kgPerWeek)} kg</p>
          <p className="text-xs text-muted">per week</p>
        </div>
        <div className="rounded-xl bg-card-2 px-2 py-2">
          <p className="text-lg font-semibold tabular-nums">{c.avgIntake.toLocaleString("en-AU")}</p>
          <p className="text-xs text-muted">avg kcal logged</p>
        </div>
        <div className="rounded-xl bg-card-2 px-2 py-2">
          <p className="text-lg font-semibold tabular-nums">{c.maintenance.toLocaleString("en-AU")}</p>
          <p className="text-xs text-muted">your maintenance</p>
        </div>
      </div>
      <p className={`text-sm ${tone}`}>{c.advice}</p>
      <p className="text-sm">
        New daily target: <span className="font-semibold">{c.targets.kcal.toLocaleString("en-AU")} kcal</span> · {c.targets.protein} g protein
      </p>
      <p className="text-xs text-muted">
        From the last 3 weeks ({c.loggedDays} full days logged, {c.weighIns} weigh-ins). Maintenance = average logged intake adjusted for your weight trend (about 7,700 kcal per kg).
        The formula guessed {c.formulaMaintenance.toLocaleString("en-AU")}. Because it&apos;s based on what you log, it also corrects for estimates that run consistently low.
      </p>
    </Card>
  );
}
