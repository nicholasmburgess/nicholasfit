import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { EXERCISES, EXTRA_EXERCISES } from "@/lib/exercises";
import { isSignedIn } from "@/lib/server/auth";
import { MODEL, claude } from "@/lib/server/estimate";

export const maxDuration = 120;

const Review = z.object({
  summary: z.string().describe("Two or three plain sentences to the lifter about last week and what changes (or why nothing changes)."),
  changes: z.array(
    z.object({
      routine: z.enum(["A", "B"]),
      action: z.enum(["swap", "set_target", "add", "remove"]),
      exerciseId: z.string().describe("Exercise id in the routine (for add: the exercise to add)"),
      newExerciseId: z.string().nullable().describe("For swap only: the replacement exercise id"),
      sets: z.number().int().nullable(),
      repMin: z.number().int().nullable(),
      repMax: z.number().int().nullable(),
      reason: z.string().describe("One short sentence the lifter will read, citing what in their log prompted this"),
    }),
  ),
});

const adj = (load: string) => (load === "dumbbell" || load === "kettlebell" ? " (adjustable set)" : "");
const CATALOG = EXERCISES.filter((e) => e.pattern !== "Cardio")
  .map((e) => `${e.id} | ${e.name} | ${e.pattern} | ${e.load}${adj(e.load)}`)
  .join("\n");
const EXTRAS = EXTRA_EXERCISES.map((e) => `${e.id} | ${e.load}${adj(e.load)} | ${e.primaryMuscles.join(", ")} | ${e.level}`).join("\n");

const SYSTEM = `You are the weekly strength coach inside a personal home-gym training app. Once a week you review the lifter's recent sessions and decide whether their two full-body routines (A and B, alternated about three times a week, about 45 minutes each) should change for the coming week. The app already handles session-to-session loading by itself (adds weight when every set reaches the top of the rep range, drops about 10% after three stalled sessions, adjusts within a session when a set is rated easy or hard), so you do NOT set weights. You only change which exercises are in each routine and their sets and rep ranges.

The lifter is a beginner rebuilding strength, aiming to lose fat while gaining muscle. Apply current evidence on resistance training:
- Beginners progress fastest by repeating the same main compound lifts with progressive overload. Do not swap an exercise that is still progressing. Variety for its own sake slows a beginner down.
- Swap an exercise only for a clear reason in the log: it has stalled across several sessions even after a weight drop, it is consistently rated hard while reps fall short, or the lifter has outgrown a beginner version (for example goblet squat near the heaviest kettlebell setting with reps at the top of the range, so move to Barbell_Squat). Swaps should keep the same movement pattern.
- Weekly volume of roughly 10 or more hard sets per muscle group supports muscle gain, with a dose-response. Add volume gradually: at most one extra set on one or two exercises per week, and only when the lifter completed at least two sessions last week with reps achieved and sets mostly rated good or easy.
- If the lifter trained fewer than two times last week, prioritise consistency: make no volume increases.
- Main compound lifts use 5 to 10 reps; accessories 8 to 15; planks are held in seconds (keep 30 to 60).
- Keep each routine within 45 minutes: no more than 6 exercises and about 16 working sets in total. Accessories such as curls, pushdowns, Pallof press or dead bugs can be added once sessions are being completed comfortably.
- Equipment rule: the lifter has ONE adjustable dumbbell/kettlebell set, so each routine may contain at most TWO exercises marked "adjustable set". Barbell and cable exercises are unlimited.
- Only use exercise ids from the two lists below. Prefer the core library: those exercises have coached form cues. You may pick from the extra list when it clearly fits better (for example a muscle the core library under-trains, or a safer variation), choosing beginner-friendly, stable movements. Never pick anything that conflicts with the lifter's rules.

Most weeks, especially in the first four weeks, the right answer is zero or one change. Never suggest more than three. Write to the lifter in plain, encouraging but factual Australian English, without jargon.

Core library (id | name | pattern | load):
${CATALOG}

Extra exercises (id | load | primary muscles | level):
${EXTRAS}`;

const IDS = new Set([...EXERCISES, ...EXTRA_EXERCISES].map((e) => e.id));

/** POST { plan, sessions, weeksTraining } -> { summary, changes } (nothing is saved here). */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Coaching needs ANTHROPIC_API_KEY in Vercel." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { plan?: unknown; sessions?: unknown; weeksTraining?: number; rules?: unknown } | null;
  const rules = Array.isArray(body?.rules) ? body.rules.filter((r): r is string => typeof r === "string").slice(0, 10).map((r) => r.slice(0, 300)) : [];
  if (!body?.plan || !Array.isArray(body.sessions)) return NextResponse.json({ error: "Missing data" }, { status: 400 });
  const text = JSON.stringify({ weeksTraining: body.weeksTraining ?? null, currentPlan: body.plan, recentSessions: body.sessions.slice(0, 30) });
  if (text.length > 60_000) return NextResponse.json({ error: "Too much data" }, { status: 413 });

  try {
    const res = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(Review) },
      messages: [{ role: "user", content: `${rules.length ? `The lifter's rules (always follow these):\n- ${rules.join("\n- ")}\n\n` : ""}Here is the lifter's current plan and their sessions from the last four weeks (newest first; sets are weight x reps, with how the set felt when rated).\n\n${text}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return NextResponse.json({ error: "Couldn't review this week. Try again later." }, { status: 422 });
    const out = res.parsed_output;
    const changes = out.changes
      .filter((c) => IDS.has(c.exerciseId) && (c.action !== "swap" || (c.newExerciseId && IDS.has(c.newExerciseId))))
      .slice(0, 3)
      .map((c) => ({
        routine: c.routine,
        action: c.action,
        exerciseId: c.exerciseId,
        ...(c.newExerciseId ? { newExerciseId: c.newExerciseId } : {}),
        ...(c.sets ? { sets: c.sets } : {}),
        ...(c.repMin ? { repMin: c.repMin } : {}),
        ...(c.repMax ? { repMax: c.repMax } : {}),
        reason: c.reason,
      }));
    return NextResponse.json({ summary: out.summary, changes });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = e.status === 429 ? "Too many requests right now. Try again in a minute." : e.status === 401 ? "The Claude key was rejected." : "Claude had a problem. Try again.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
