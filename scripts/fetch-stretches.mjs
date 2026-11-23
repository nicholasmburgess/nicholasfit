// Pulls the stretches the Flexibility tab uses from Free Exercise DB (public domain, Unlicense)
// https://github.com/yuhonas/free-exercise-db
// Usage: node scripts/fetch-stretches.mjs   (then add cues for any new id in src/lib/stretches.ts)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main";
const IDS = [
  // Held stretches
  "Kneeling_Hip_Flexor", "Leg-Up_Hamstring_Stretch", "Seated_Floor_Hamstring_Stretch", "Ankle_On_The_Knee",
  "Knee_Across_The_Body", "On_Your_Side_Quad_Stretch", "Calf_Stretch_Hands_Against_Wall",
  "Standing_Soleus_And_Achilles_Stretch", "Side_Lying_Groin_Stretch", "Chest_And_Front_Of_Shoulder_Stretch",
  "One_Arm_Against_Wall", "Shoulder_Stretch", "Triceps_Stretch", "Upper_Back_Stretch", "Childs_Pose",
  // Moving (warm-up) drills
  "Cat_Stretch", "Worlds_Greatest_Stretch", "Front_Leg_Raises", "Standing_Hip_Circles", "Arm_Circles",
  "Inchworm", "Groiners",
];

const root = path.resolve(import.meta.dirname, "..");
const all = await (await fetch(`${BASE}/dist/exercises.json`)).json();
const out = [];
for (const id of IDS) {
  const ex = all.find((e) => e.id === id);
  if (!ex) throw new Error(`Missing stretch ${id}`);
  const images = [];
  for (const img of ex.images) {
    const res = await fetch(`${BASE}/exercises/${img}`);
    if (!res.ok) throw new Error(`Image ${img}: ${res.status}`);
    const dest = path.join(root, "public", "stretches", img);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    images.push(`/stretches/${img}`);
  }
  out.push({ id: ex.id, name: ex.name, primaryMuscles: ex.primaryMuscles, instructions: ex.instructions, images });
}
await writeFile(path.join(root, "src", "data", "stretch-db.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${out.length} stretches`);
