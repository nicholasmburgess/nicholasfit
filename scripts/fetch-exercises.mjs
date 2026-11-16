// Pulls the exercises this app uses from Free Exercise DB (public domain, Unlicense)
// https://github.com/yuhonas/free-exercise-db
// Usage: node scripts/fetch-exercises.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main";
const IDS = [
  "Goblet_Squat", "Barbell_Squat", "Barbell_Bench_Press_-_Medium_Grip", "Dumbbell_Bench_Press",
  "Incline_Dumbbell_Press", "Seated_Cable_Rows", "One-Arm_Dumbbell_Row", "Romanian_Deadlift",
  "Barbell_Deadlift", "Barbell_Hip_Thrust", "Dumbbell_Shoulder_Press",
  "Wide-Grip_Lat_Pulldown", "Close-Grip_Front_Lat_Pulldown", "Split_Squat_with_Dumbbells",
  "Face_Pull", "One-Arm_Kettlebell_Swings", "Triceps_Pushdown_-_Rope_Attachment", "Hammer_Curls",
  "Dumbbell_Bicep_Curl", "Plank", "Dead_Bug", "Pallof_Press", "Rowing_Stationary",
  "Seated_Barbell_Military_Press", "Barbell_Incline_Bench_Press_-_Medium_Grip", "Side_Lateral_Raise",
  "Cable_Seated_Lateral_Raise", "Cable_Rear_Delt_Fly", "Pushups",
];

const root = path.resolve(import.meta.dirname, "..");
const all = await (await fetch(`${BASE}/dist/exercises.json`)).json();
const out = [];
for (const id of IDS) {
  const ex = all.find((e) => e.id === id);
  if (!ex) throw new Error(`Missing exercise ${id}`);
  const images = [];
  for (const img of ex.images) {
    const res = await fetch(`${BASE}/exercises/${img}`);
    if (!res.ok) throw new Error(`Image ${img}: ${res.status}`);
    const dest = path.join(root, "public", "demos", img);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    images.push(`/demos/${img}`);
  }
  out.push({
    id: ex.id, name: ex.name, equipment: ex.equipment, level: ex.level, category: ex.category,
    primaryMuscles: ex.primaryMuscles, secondaryMuscles: ex.secondaryMuscles,
    instructions: ex.instructions, images,
  });
}
await writeFile(path.join(root, "src", "data", "exercise-db.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${out.length} exercises`);
