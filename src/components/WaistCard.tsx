"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/Card";
import { LiftLine } from "@/components/Charts";
import { foodError, foodStore } from "@/lib/food-store";
import { newId } from "@/lib/store";
import type { Measurement } from "@/lib/types";

export function WaistCard() {
  const [list, setList] = useState<Measurement[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [cm, setCm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    foodStore
      .listMeasurements()
      .then((m) => setList(m.filter((x) => x.kind === "waist")))
      .catch((e) => {
        setError(foodError(e).replace("0002_food.sql", "0004_measurements.sql"));
        setList([]);
      });
  useEffect(() => {
    load();
  }, []);
  if (!list) return null;
  const n = Number(cm.replace(",", "."));
  const last = list.at(-1);
  const due = !last || Date.now() - Date.parse(last.measuredAt) > 6 * 86400000;

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Waist</h2>
        {!adding && (
          <button className="text-sm text-accent" onClick={() => setAdding(true)}>
            {due ? "Measure now" : "Add"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {list.length > 0 ? (
        <LiftLine name={`${last!.cm} cm`} unit="cm" points={list.map((m) => ({ date: m.measuredAt, value: m.cm }))} />
      ) : (
        !adding && <p className="text-sm text-muted">Measure once a week. In a recomp your weight can stall while your waist shrinks, so this shows fat loss best.</p>
      )}
      {adding && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Tape level with your belly button, standing relaxed, after breathing out normally. Same time of day each week.</p>
          <label className="block text-xs text-muted">
            Waist (cm)
            <input inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-base text-text tabular-nums" />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!(n >= 50 && n <= 200)}
              onClick={async () => {
                try {
                  await foodStore.saveMeasurement({ id: newId(), measuredAt: new Date().toISOString(), kind: "waist", cm: Math.round(n * 10) / 10 });
                  setAdding(false);
                  setCm("");
                  load();
                } catch (e) {
                  setError(foodError(e));
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
