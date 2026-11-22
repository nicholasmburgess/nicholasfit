import db from "@/data/exercise-db.json";
import pool from "@/data/exercise-pool.json";
import type { Unit } from "./types";

export type LoadType = "barbell" | "dumbbell" | "cable" | "kettlebell" | "bodyweight" | "machine";
export type Pattern = "Squat" | "Hinge" | "Push" | "Pull" | "Lunge" | "Arms" | "Core" | "Cardio";

type Meta = {
  name?: string;
  pattern: Pattern;
  load: LoadType;
  /** Weight added when every set reaches the top of the rep range (kg; per hand for dumbbells). */
  increment: number;
  unit?: Unit;
  cues: string[];
  mistakes: string[];
};

const META: Record<string, Meta> = {
  Goblet_Squat: {
    pattern: "Squat", load: "kettlebell", increment: 2,
    cues: ["Hold the bell at your chest, elbows pointing down", "Feet shoulder width, toes slightly out", "Sit down between your heels, chest up", "Push the floor away through your whole foot"],
    mistakes: ["Heels lifting off the floor", "Knees caving inward"],
  },
  Barbell_Squat: {
    name: "Back Squat", pattern: "Squat", load: "barbell", increment: 5,
    cues: ["Bar on your upper back, set the safeties just below bottom depth", "Big breath and brace before each rep", "Hips and knees bend together, knees track over toes", "Drive up keeping your chest and hips rising together"],
    mistakes: ["Hips shooting up first so it turns into a good morning", "Cutting depth as the weight gets heavier"],
  },
  "Barbell_Bench_Press_-_Medium_Grip": {
    name: "Bench Press", pattern: "Push", load: "barbell", increment: 2.5,
    cues: ["Set the rack safeties at chest height", "Shoulder blades squeezed back and down", "Lower to mid-chest, elbows about 45 degrees from your body", "Feet planted, press up and slightly back"],
    mistakes: ["Bouncing the bar off your chest", "Flaring elbows straight out to the sides"],
  },
  Dumbbell_Bench_Press: {
    pattern: "Push", load: "dumbbell", increment: 2,
    cues: ["Kick the dumbbells up from your knees as you lie back", "Shoulder blades back and down", "Lower until the bells are level with your chest", "Press up and slightly together"],
    mistakes: ["Dropping too deep and straining the shoulders", "Wrists bending back"],
  },
  Incline_Dumbbell_Press: {
    pattern: "Push", load: "dumbbell", increment: 2,
    cues: ["Bench at 30 to 45 degrees", "Lower to upper chest with elbows slightly tucked", "Press up over your shoulders"],
    mistakes: ["Bench set too steep, turning it into a shoulder press", "Arching off the bench"],
  },
  Seated_Cable_Rows: {
    name: "Cable Row", pattern: "Pull", load: "cable", increment: 2.5,
    cues: ["Sit tall with a slight bend in the knees", "Pull the handle to your lower ribs", "Squeeze shoulder blades together at the end", "Let the arms straighten fully under control"],
    mistakes: ["Rocking the torso back to move the weight", "Shrugging shoulders up to your ears"],
  },
  "One-Arm_Dumbbell_Row": {
    name: "One-Arm Dumbbell Row", pattern: "Pull", load: "dumbbell", increment: 2,
    cues: ["One hand and knee on the bench, back flat", "Pull the dumbbell toward your hip", "Pause at the top, lower slowly"],
    mistakes: ["Twisting the torso to swing the weight up", "Rounding the back"],
  },
  Romanian_Deadlift: {
    pattern: "Hinge", load: "barbell", increment: 5,
    cues: ["Start standing, bar against your thighs", "Push your hips back, knees soft but fixed", "Lower until you feel a strong hamstring stretch, usually just below the knee", "Keep the bar touching your legs the whole way"],
    mistakes: ["Rounding the lower back to reach lower", "Turning it into a squat by bending the knees more"],
  },
  Barbell_Deadlift: {
    name: "Deadlift", pattern: "Hinge", load: "barbell", increment: 5,
    cues: ["Bar over mid-foot, shins close", "Grip just outside your legs, pull the slack out of the bar", "Brace, then push the floor away", "Stand tall with hips through, don't lean back"],
    mistakes: ["Back rounding off the floor", "Bar drifting away from the legs"],
  },
  Barbell_Hip_Thrust: {
    name: "Hip Thrust", pattern: "Hinge", load: "barbell", increment: 5,
    cues: ["Upper back on the bench edge, bar padded across hips", "Feet flat, shins vertical at the top", "Drive through heels, squeeze glutes hard at the top", "Chin tucked, ribs down"],
    mistakes: ["Arching the lower back instead of extending the hips", "Feet too far forward"],
  },
  Dumbbell_Shoulder_Press: {
    name: "Seated Dumbbell Shoulder Press", pattern: "Push", load: "dumbbell", increment: 2,
    cues: ["Sit on the bench set upright, back supported, dumbbells at shoulder height", "Brace your core, ribs down", "Press up until arms are straight, bells close together", "Lower under control to shoulder height"],
    mistakes: ["Leaning back and arching the lower back", "Cutting the range short"],
  },

  "Wide-Grip_Lat_Pulldown": {
    name: "Lat Pulldown", pattern: "Pull", load: "cable", increment: 2.5,
    cues: ["Grip a little wider than shoulders", "Lean back slightly, chest up", "Pull the bar to your upper chest, elbows down and back", "Let it rise slowly until arms are straight"],
    mistakes: ["Pulling behind the neck", "Swinging the body to move the weight"],
  },
  "Close-Grip_Front_Lat_Pulldown": {
    name: "Close-Grip Pulldown", pattern: "Pull", load: "cable", increment: 2.5,
    cues: ["Narrow or neutral grip", "Pull toward your upper chest", "Squeeze the lats at the bottom"],
    mistakes: ["Leaning far back", "Using momentum"],
  },
  Split_Squat_with_Dumbbells: {
    name: "Dumbbell Split Squat", pattern: "Lunge", load: "dumbbell", increment: 2,
    cues: ["Long stride stance, back heel up", "Drop the back knee straight down toward the floor", "Front knee tracks over toes", "Do all reps on one leg, then switch (reps are per leg)"],
    mistakes: ["Stance too narrow, wobbling sideways", "Pushing off the back leg instead of the front"],
  },
  Face_Pull: {
    pattern: "Pull", load: "cable", increment: 2.5,
    cues: ["Rope attachment at upper chest height or higher", "Pull the rope toward your face, hands apart", "Finish with elbows high and knuckles pointing back"],
    mistakes: ["Going too heavy and leaning back", "Elbows dropping"],
  },
  "One-Arm_Kettlebell_Swings": {
    name: "Kettlebell Swing", pattern: "Hinge", load: "kettlebell", increment: 2,
    cues: ["Hike the bell back between your legs like a football snap", "Snap your hips forward to float the bell to chest height", "Arms are ropes, hips do the work", "Stand tall and squeeze glutes at the top"],
    mistakes: ["Squatting the swing instead of hinging", "Lifting with the arms"],
  },
  "Triceps_Pushdown_-_Rope_Attachment": {
    name: "Triceps Rope Pushdown", pattern: "Arms", load: "cable", increment: 2.5,
    cues: ["Elbows pinned at your sides", "Push down and spread the rope at the bottom", "Control it back up to 90 degrees"],
    mistakes: ["Elbows drifting forward", "Leaning over the weight"],
  },
  Hammer_Curls: {
    pattern: "Arms", load: "dumbbell", increment: 1,
    cues: ["Palms face each other", "Elbows stay at your sides", "Lower slowly"],
    mistakes: ["Swinging the body", "Half reps"],
  },
  Dumbbell_Bicep_Curl: {
    name: "Dumbbell Curl", pattern: "Arms", load: "dumbbell", increment: 1,
    cues: ["Palms forward, elbows at your sides", "Curl up without moving the elbows", "Lower slowly to straight arms"],
    mistakes: ["Swinging the body", "Elbows moving forward"],
  },
  Plank: {
    pattern: "Core", load: "bodyweight", increment: 0, unit: "seconds",
    cues: ["Forearms under shoulders", "Straight line from head to heels", "Squeeze glutes and brace like you're about to be poked in the stomach", "Breathe slowly"],
    mistakes: ["Hips sagging", "Hips piked high"],
  },
  Dead_Bug: {
    pattern: "Core", load: "bodyweight", increment: 0,
    cues: ["Lower back pressed into the floor the whole time", "Extend the opposite arm and leg slowly", "Exhale as you extend"],
    mistakes: ["Lower back arching off the floor", "Rushing"],
  },
  Pallof_Press: {
    pattern: "Core", load: "cable", increment: 2.5,
    cues: ["Stand side-on to the cable, handle at your chest", "Press straight out and hold for a second", "Don't let the cable twist you"],
    mistakes: ["Rotating toward the cable", "Standing too close, so there's no tension"],
  },
  Seated_Barbell_Military_Press: {
    name: "Seated Barbell Shoulder Press", pattern: "Push", load: "barbell", increment: 2.5,
    cues: ["Bench upright inside the rack, bar set just above shoulder height when seated", "Grip just wider than shoulders, back against the pad", "Press straight up, moving your head back slightly so the bar passes your face", "Lower to your upper chest under control"],
    mistakes: ["Arching off the backrest to push the weight", "Bar drifting forward away from your face"],
  },
  "Barbell_Incline_Bench_Press_-_Medium_Grip": {
    name: "Incline Bench Press", pattern: "Push", load: "barbell", increment: 2.5,
    cues: ["Bench at about 30 degrees, safeties at chest height", "Shoulder blades back and down", "Lower to your upper chest", "Press up and slightly back over your shoulders"],
    mistakes: ["Bench set too steep", "Bouncing the bar off your chest"],
  },
  Side_Lateral_Raise: {
    name: "Lateral Raise", pattern: "Push", load: "dumbbell", increment: 1,
    cues: ["Light dumbbells at your sides, slight bend in the elbows", "Raise out to the sides until arms are level with your shoulders", "Lead with the elbows, thumbs level or slightly down", "Lower slowly"],
    mistakes: ["Swinging the body to lift the weight", "Shrugging the shoulders up"],
  },
  Cable_Seated_Lateral_Raise: {
    name: "Cable Lateral Raise", pattern: "Push", load: "cable", increment: 2.5,
    cues: ["Pulley at the lowest setting, stand or sit side-on", "Raise the handle out to the side to shoulder height", "Slow on the way down, keep tension"],
    mistakes: ["Leaning away to cheat the weight up", "Going above shoulder height"],
  },
  Cable_Rear_Delt_Fly: {
    name: "Cable Rear Delt Fly", pattern: "Pull", load: "cable", increment: 2.5,
    cues: ["Pulleys at shoulder height, cross the cables and hold opposite handles", "Arms nearly straight, pull out and back to a T", "Squeeze between the shoulder blades, return slowly"],
    mistakes: ["Turning it into a row by bending the elbows a lot", "Using momentum"],
  },
  Pushups: {
    name: "Push-up", pattern: "Push", load: "bodyweight", increment: 0,
    cues: ["Hands just wider than shoulders, body in a straight line", "Lower until your chest is a fist above the floor", "Elbows about 45 degrees from your body", "Too hard? Put your hands on the bench"],
    mistakes: ["Hips sagging", "Only going halfway down"],
  },
  Rowing_Stationary: {
    name: "Rowing (Concept2)", pattern: "Cardio", load: "machine", increment: 0, unit: "minutes",
    cues: ["Legs, then body, then arms on the drive", "Arms, then body, then legs on the recovery", "Easy pace you could hold a conversation at", "Damper around 3 to 5"],
    mistakes: ["Pulling with the arms early", "Rushing the slide forward"],
  },
};

type DbExercise = (typeof db)[number];

export type Exercise = DbExercise & Meta & { name: string; unit: Unit };

export const EXERCISES: Exercise[] = db.map((e) => {
  const meta = META[e.id];
  if (!meta) throw new Error(`No metadata for exercise ${e.id}`);
  return { ...e, ...meta, name: meta.name ?? e.name, unit: meta.unit ?? "reps" };
});

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

type PoolExercise = (typeof pool)[number];

const LOADS: Record<string, LoadType> = { barbell: "barbell", dumbbell: "dumbbell", cable: "cable", kettlebells: "kettlebell", "body only": "bodyweight" };
const INCREMENT: Record<LoadType, number> = { barbell: 2.5, dumbbell: 2, cable: 2.5, kettlebell: 2, bodyweight: 0, machine: 0 };

function patternFor(e: PoolExercise): Pattern {
  const m = e.primaryMuscles[0] ?? "";
  if (/lunge|split|step/i.test(e.id)) return "Lunge";
  if (m === "quadriceps" || m === "calves" || m === "adductors" || m === "abductors") return "Squat";
  if (m === "hamstrings" || m === "glutes" || m === "lower back") return "Hinge";
  if (m === "shoulders" && /rear|reverse|row/i.test(e.id)) return "Pull";
  if (m === "chest" || m === "shoulders") return "Push";
  if (m === "lats" || m === "middle back" || m === "traps") return "Pull";
  if (m === "abdominals") return "Core";
  return "Arms";
}

/**
 * Extra exercises from Free Exercise DB that the weekly coach can add (filtered for the home gym
 * and the low ceiling). They get generic settings and the database's own instructions as cues.
 */
const POOL = new Map(
  pool.map((e): [string, Exercise] => {
    const load = LOADS[e.equipment] ?? "bodyweight";
    return [
      e.id,
      {
        ...e,
        category: "strength",
        name: e.name,
        pattern: patternFor(e),
        load,
        increment: INCREMENT[load],
        unit: "reps",
        cues: e.instructions,
        mistakes: [],
      } as Exercise,
    ];
  }),
);

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id) ?? POOL.get(id);
}

/** Exercises outside the core library that the coach may pick from. */
export const EXTRA_EXERCISES: Exercise[] = [...POOL.values()];

export const PATTERNS: Pattern[] = ["Squat", "Hinge", "Push", "Pull", "Lunge", "Arms", "Core", "Cardio"];

export function weightLabel(ex: Exercise): string {
  if (ex.load === "bodyweight" || ex.load === "machine") return "";
  return ex.load === "dumbbell" ? "kg each" : "kg";
}

export function unitLabel(unit: Unit): string {
  return unit === "seconds" ? "sec" : unit === "minutes" ? "min" : "reps";
}

export function videoSearchUrl(ex: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${ex.name} proper form`)}`;
}
