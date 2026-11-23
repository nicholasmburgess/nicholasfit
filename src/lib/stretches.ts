import db from "@/data/stretch-db.json";

/**
 * Stretches and routines for the Flexibility tab. Photos and step-by-step text come from Free
 * Exercise DB (public domain, scripts/fetch-stretches.mjs); names, cues and routines are ours.
 *
 * How the routines are built (sources are listed on the Flexibility page):
 * - Held stretches: 30 to 60 seconds per side, to mild tension, never pain.
 * - About 5 minutes per area each week, spread over 5 or more days, gives the biggest gains in range
 *   of motion (Thomas et al. 2018). Total time matters more than which stretch type (Konrad et al. 2024).
 * - Before lifting, moving drills only. Short static holds don't hurt strength, but drills prepare the
 *   joints better (Behm et al. 2016). Held stretches go after lifting or on rest days.
 */

export type Area = "Hips" | "Legs" | "Upper body" | "Back";
export type Kind = "hold" | "move";

type Meta = {
  name: string;
  area: Area;
  kind: Kind;
  /** Done one side at a time (the timer runs twice and calls the switch). */
  sides: boolean;
  /** What you should feel, then how to do it. Kept short so it reads at arm's length. */
  feel: string;
  cues: string[];
  /** Name to look for in ExerciseDB's video library, when ours doesn't match theirs. */
  videoSearch?: string;
};

const META: Record<string, Meta> = {
  Kneeling_Hip_Flexor: {
    name: "Kneeling Hip Flexor Stretch", area: "Hips", kind: "hold", sides: true,
    feel: "Front of the hip on the kneeling side",
    cues: ["Kneel on one knee on a mat, other foot flat in front", "Squeeze the glute of the kneeling leg and tuck your tailbone under", "Shift your hips forward slightly, chest tall"],
    videoSearch: "kneeling hip flexor stretch",
  },
  "Leg-Up_Hamstring_Stretch": {
    name: "Lying Hamstring Stretch", area: "Legs", kind: "hold", sides: true,
    feel: "Back of the raised thigh",
    cues: ["Lie on your back, other leg straight on the floor", "Hold behind the raised thigh (or loop a towel round the foot)", "Straighten the knee until you feel the stretch, keep your back flat"],
    videoSearch: "lying hamstring stretch",
  },
  Seated_Floor_Hamstring_Stretch: {
    name: "Seated Hamstring Stretch", area: "Legs", kind: "hold", sides: true,
    feel: "Back of the straight leg",
    cues: ["Sit with one leg straight, the other foot against its inner thigh", "Hinge forward from the hips with a long back", "Reach toward your ankle, don't round to get lower"],
    videoSearch: "seated hamstring stretch",
  },
  Ankle_On_The_Knee: {
    name: "Figure-4 Glute Stretch", area: "Hips", kind: "hold", sides: true,
    feel: "Outer hip and glute of the crossed leg",
    cues: ["Lie on your back, cross one ankle over the other knee", "Pull the bottom thigh toward your chest", "Keep your head and shoulders relaxed on the floor"],
    videoSearch: "lying glute stretch",
  },
  Knee_Across_The_Body: {
    name: "Lying Twist", area: "Back", kind: "hold", sides: true,
    feel: "Outer hip and lower back",
    cues: ["Lie on your back, arms out wide", "Bring one knee across your body toward the floor", "Keep both shoulders down and breathe slowly"],
    videoSearch: "lying knee across body stretch",
  },
  On_Your_Side_Quad_Stretch: {
    name: "Side-Lying Quad Stretch", area: "Legs", kind: "hold", sides: true,
    feel: "Front of the top thigh",
    cues: ["Lie on your side, head resting on your arm", "Hold the top ankle and bring the heel toward your glute", "Keep knees together and push the hip forward a little"],
    videoSearch: "side lying quadriceps stretch",
  },
  Calf_Stretch_Hands_Against_Wall: {
    name: "Wall Calf Stretch", area: "Legs", kind: "hold", sides: true,
    feel: "Upper calf of the back leg",
    cues: ["Hands on a wall or the rack, one foot well behind", "Back leg straight, heel pressed to the floor", "Lean forward until you feel the calf"],
    videoSearch: "calf stretch with hands against wall",
  },
  Standing_Soleus_And_Achilles_Stretch: {
    name: "Bent-Knee Calf Stretch", area: "Legs", kind: "hold", sides: true,
    feel: "Low calf and Achilles of the back leg",
    cues: ["Short split stance, both heels down", "Bend both knees and sink straight down", "Helps your ankles bend for deeper squats"],
    videoSearch: "standing soleus and achilles stretch",
  },
  Side_Lying_Groin_Stretch: {
    name: "Side-Lying Groin Stretch", area: "Hips", kind: "hold", sides: true,
    feel: "Inner thigh",
    cues: ["Lie on your side, bottom leg straight", "Lift the top leg up and slightly back, hold it at the ankle or calf", "Let it lower gently until you feel the inner thigh"],
    videoSearch: "side lying groin stretch",
  },
  Chest_And_Front_Of_Shoulder_Stretch: {
    name: "Chest and Shoulder Stretch", area: "Upper body", kind: "hold", sides: false,
    feel: "Across the chest and front of the shoulders",
    cues: ["Hold a broom handle or towel wide, arms straight", "Lift it up and gently back as far as is comfortable", "Ribs down, don't arch your lower back"],
    videoSearch: "chest and front of shoulder stretch",
  },
  One_Arm_Against_Wall: {
    name: "Wall Lat Stretch", area: "Back", kind: "hold", sides: true,
    feel: "Side of the back, under the raised arm",
    cues: ["Forearm on a wall or rack upright, just above head height", "Step back and let your chest sink toward the floor", "Push your hips back and away from the wall"],
    videoSearch: "one arm against wall",
  },
  Shoulder_Stretch: {
    name: "Cross-Body Shoulder Stretch", area: "Upper body", kind: "hold", sides: true,
    feel: "Back of the shoulder",
    cues: ["Bring one straight arm across your chest", "Hold it above the elbow with the other hand", "Keep the shoulder down away from your ear"],
    videoSearch: "cross body shoulder stretch",
  },
  Triceps_Stretch: {
    name: "Triceps Stretch", area: "Upper body", kind: "hold", sides: true,
    feel: "Back of the upper arm",
    cues: ["Reach one hand down between your shoulder blades", "Gently push the elbow back with the other hand", "Stand tall, don't lean sideways"],
    videoSearch: "triceps stretch",
  },
  Upper_Back_Stretch: {
    name: "Upper Back Stretch", area: "Back", kind: "hold", sides: false,
    feel: "Between the shoulder blades",
    cues: ["Clasp your hands and push them straight out in front", "Round your upper back and spread the shoulder blades", "Tuck your chin slightly"],
    videoSearch: "upper back stretch",
  },
  Childs_Pose: {
    name: "Child's Pose", area: "Back", kind: "hold", sides: false,
    feel: "Lower back and along the sides",
    cues: ["Kneel, sit back toward your heels", "Walk your hands forward and rest your forehead down", "Breathe slowly into your back"],
    videoSearch: "child pose",
  },
  Cat_Stretch: {
    name: "Cat-Cow", area: "Back", kind: "move", sides: false,
    feel: "Whole spine moving",
    cues: ["Hands under shoulders, knees under hips", "Round your back up, then let it sag as you look forward", "Slow, about 8 times"],
    videoSearch: "cat stretch",
  },
  Worlds_Greatest_Stretch: {
    name: "World's Greatest Stretch", area: "Hips", kind: "move", sides: true,
    feel: "Hips, groin and upper back",
    cues: ["Step into a long lunge, both hands down inside the front foot", "Drop the elbow toward the instep, then rotate that arm up to the ceiling", "3 slow reps each side"],
    videoSearch: "world greatest stretch",
  },
  Front_Leg_Raises: {
    name: "Leg Swings", area: "Hips", kind: "move", sides: true,
    feel: "Hamstrings and hip flexors loosening",
    cues: ["Hold the rack for balance", "Swing one straight leg forward and back, growing the range", "About 10 each leg"],
    videoSearch: "leg swing",
  },
  Standing_Hip_Circles: {
    name: "Hip Circles", area: "Hips", kind: "move", sides: true,
    feel: "Hip joint moving through its range",
    cues: ["Hold the rack, lift one knee to hip height", "Draw a big slow circle out to the side and back down", "5 each way, each leg"],
    videoSearch: "standing hip circles",
  },
  Arm_Circles: {
    name: "Arm Circles", area: "Upper body", kind: "move", sides: false,
    feel: "Shoulders warming up",
    cues: ["Arms out to the sides", "Small circles growing bigger", "15 forward, then 15 back"],
    videoSearch: "arm circles",
  },
  Inchworm: {
    name: "Inchworm", area: "Legs", kind: "move", sides: false,
    feel: "Hamstrings and shoulders",
    cues: ["Bend forward, hands to the floor (bend your knees as needed)", "Walk your hands out to a push-up position", "Walk your feet back up to your hands, 4 to 5 reps"],
    videoSearch: "inchworm",
  },
  Groiners: {
    name: "Groiners", area: "Hips", kind: "move", sides: false,
    feel: "Groin and hip flexors",
    cues: ["Start in a push-up position", "Step one foot outside the same-side hand, sink the hips", "Step back and switch, alternate slowly"],
    videoSearch: "groiners",
  },
};

type DbStretch = (typeof db)[number];
export type Stretch = DbStretch & Meta;

export const STRETCHES: Stretch[] = db.filter((s) => META[s.id]).map((s) => ({ ...s, ...META[s.id] }));
export const AREAS: Area[] = ["Hips", "Legs", "Back", "Upper body"];

export function getStretch(id: string): Stretch | undefined {
  return STRETCHES.find((s) => s.id === id);
}

/** A held stretch takes its time from the intensity level; a moving drill has a fixed time. */
export type Step = { id: string; seconds?: number };
export type Routine = { key: string; name: string; when: string; why: string; steps: Step[]; /** Moving drills only: no intensity levels. */ fixed?: boolean };

/**
 * Intensity: how hard you lean into each stretch and how long you hold it. Longer holds add up to
 * more stretching time, which drives range-of-motion gains (Thomas et al. 2018). Strong but
 * painless tension is fine for healthy adults; pain means back off.
 */
export type Level = { n: number; name: string; hold: number; tension: string };
export const LEVELS: Level[] = [
  { n: 1, name: "Gentle", hold: 30, tension: "3–4 out of 10. A light pull, fully relaxed." },
  { n: 2, name: "Steady", hold: 45, tension: "5–6 out of 10. A clear stretch, easy breathing." },
  { n: 3, name: "Deep", hold: 60, tension: "7 out of 10. Strong, but never painful." },
  { n: 4, name: "Long", hold: 90, tension: "7 out of 10, held longer. Ease deeper as it releases." },
];
export const getLevel = (n: number) => LEVELS[Math.min(Math.max(Math.round(n), 1), LEVELS.length) - 1];

export const ROUTINES: Routine[] = [
  {
    key: "cooldown", name: "After lifting", when: "Straight after a workout",
    why: "Muscles are warm, so it's the easiest time to fit stretching in.",
    steps: [
      { id: "Kneeling_Hip_Flexor" },
      { id: "Leg-Up_Hamstring_Stretch" },
      { id: "Ankle_On_The_Knee" },
      { id: "Calf_Stretch_Hands_Against_Wall" },
      { id: "Chest_And_Front_Of_Shoulder_Stretch" },
      { id: "One_Arm_Against_Wall" },
      { id: "Childs_Pose" },
    ],
  },
  {
    key: "daily", name: "Full body", when: "Rest days or evenings",
    why: "Covers the areas that sitting and lifting tighten most.",
    steps: [
      { id: "Kneeling_Hip_Flexor" },
      { id: "Leg-Up_Hamstring_Stretch" },
      { id: "On_Your_Side_Quad_Stretch" },
      { id: "Ankle_On_The_Knee" },
      { id: "Knee_Across_The_Body" },
      { id: "Standing_Soleus_And_Achilles_Stretch" },
      { id: "Chest_And_Front_Of_Shoulder_Stretch" },
      { id: "One_Arm_Against_Wall" },
      { id: "Shoulder_Stretch" },
      { id: "Childs_Pose" },
    ],
  },
  {
    key: "squat", name: "Squat depth", when: "Any day, especially after leg days",
    why: "Ankles and hips are what usually limit how deep you can squat.",
    steps: [
      { id: "Standing_Soleus_And_Achilles_Stretch" },
      { id: "Calf_Stretch_Hands_Against_Wall" },
      { id: "Kneeling_Hip_Flexor" },
      { id: "Groiners", seconds: 30 },
      { id: "Ankle_On_The_Knee" },
      { id: "Side_Lying_Groin_Stretch" },
    ],
  },
  {
    key: "warmup", name: "Warm-up", when: "Before lifting", fixed: true,
    why: "Moving drills, not long holds, get your joints ready to lift.",
    steps: [
      { id: "Cat_Stretch", seconds: 40 },
      { id: "Worlds_Greatest_Stretch", seconds: 30 },
      { id: "Front_Leg_Raises", seconds: 25 },
      { id: "Standing_Hip_Circles", seconds: 20 },
      { id: "Arm_Circles", seconds: 30 },
      { id: "Inchworm", seconds: 40 },
    ],
  },
];

export function getRoutine(key: string): Routine | undefined {
  return ROUTINES.find((r) => r.key === key);
}

/** Seconds of "get ready" before each stretch, and to switch sides. */
export const READY_SECONDS = 5;
export const SWITCH_SECONDS = 4;

/** The timeline a routine plays: one entry per stretch per side. */
export type Block = { id: string; seconds: number; side: "left" | "right" | null; first: boolean };

export function blocksFor(r: Routine, level: number): Block[] {
  const hold = getLevel(level).hold;
  return r.steps.flatMap((s): Block[] => {
    const st = getStretch(s.id);
    if (!st) return [];
    const seconds = s.seconds ?? hold;
    return st.sides
      ? [
          { id: s.id, seconds, side: "left" as const, first: true },
          { id: s.id, seconds, side: "right" as const, first: false },
        ]
      : [{ id: s.id, seconds, side: null, first: true }];
  });
}

export function routineSeconds(r: Routine, level: number): number {
  return blocksFor(r, level).reduce((t, b) => t + b.seconds + (b.first ? READY_SECONDS : SWITCH_SECONDS), 0);
}

export const routineMinutes = (r: Routine, level: number) => Math.max(1, Math.round(routineSeconds(r, level) / 60));

/** Areas a routine works, for the progress view and Claude's review. */
export const routineAreas = (r: Routine) => [...new Set(r.steps.map((s) => getStretch(s.id)?.area).filter(Boolean))] as Area[];
