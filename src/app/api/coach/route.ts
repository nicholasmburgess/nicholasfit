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

const SYSTEM = `You are the weekly strength coach inside a personal home-gym training app. Once a week you review the lifter's recent sessions and decide whether their two full-body routines (A and B, alternated about three times a week, about 45 minutes each) should change for the coming week. The app already handles session-to-session loading by itself (adds weight when every set reaches the top of the rep range, drops about 10% after three stalled sessions, repeats a weight once when the top of the range was reached on a hard last set, adjusts within a session when a set is rated easy or hard), so you do NOT set weights. You only change which exercises are in each routine and their sets and rep ranges.

The lifter is a beginner rebuilding strength, aiming to lose fat while gaining muscle. Apply current evidence on resistance training:
- Beginners progress fastest by repeating the same main compound lifts with progressive overload. Do not swap an exercise that is still progressing. Variety for its own sake slows a beginner down.
- Swap an exercise only for a clear reason in the log: it has stalled across several sessions even after a weight drop, it is consistently rated hard while reps fall short, or the lifter has outgrown a beginner version (for example goblet squat near the heaviest kettlebell setting with reps at the top of the range, so move to Barbell_Squat). Swaps should keep the same movement pattern.
- Weekly volume: more hard sets per muscle give more muscle and strength, with diminishing returns (Pelland 2024 meta-regression; sets counted fractionally, 1 for the main muscle and 0.5 for helpers). You are given muscleSets.planned (weekly sets per muscle the current plan prescribes at three sessions a week, counted that way) and muscleSets.lastWeek (what was actually done). Use these numbers, do not estimate them. Aim to bring each main muscle towards about 10 weekly sets, raising the lowest first (often chest, biceps or triceps). Do not add sets to a muscle already at 15 or more. Add volume gradually: at most one extra set on one or two exercises per week, and only when the lifter completed at least two sessions last week with reps achieved and sets mostly rated good or easy.
- Set ratings are reps in reserve: easy = 4 or more reps left, good = 2-3 left, hard = 0-1 left. Mostly good is the target. Many easy sets mean the rep range or load is too light; many hard sets with reps falling mean too much.
- If the lifter trained fewer than two times last week, prioritise consistency: make no volume increases.
- Recovery data from Apple Health may be included (7-day averages versus the 3 weeks before). Partial sleep loss has only a small, uncertain effect on strength (Craven 2022 meta-analysis), and no fixed resting heart rate or HRV cut-off has been validated, so treat these as warning signs, not rules. Make no volume increases only when two signs agree: for example sleep under 6.5 hours (or an hour less than the earlier weeks) together with resting heart rate up 5 bpm or more, or either of those together with reps falling or sets rated hard more than usual. A single sign on its own: still allow progress, and mention it in the summary. HRV is supporting evidence only. If recovery data is missing, ignore it.
- Rows on the Concept2 are listed separately (rows: easy rows, and guided tempo or interval rows that have their own review). You do not change rows. Count more than one hard row in a week, or rows on the day before a lower-body session, as extra fatigue when judging stalled leg lifts, and mention it in the summary if it seems to matter.
- Do not schedule deload weeks: in a trial, a planned deload week cost lower-body strength with no gain in muscle (Coleman 2024), and a beginner on three sessions a week builds little fatigue. The app already drops a stalled lift by about 10%. If three or more lifts stalled in the same week, treat it as general fatigue: make no volume increases and name the likely cause (sleep, missed sessions, eating too little) in the summary rather than swapping exercises.
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

/** POST { plan, sessions, weeksTraining, recovery?, muscleSets? } -> { summary, changes } (nothing is saved here). */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Coaching needs ANTHROPIC_API_KEY in Vercel." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { plan?: unknown; sessions?: unknown; weeksTraining?: number; rules?: unknown; recovery?: unknown; muscleSets?: unknown; rows?: unknown } | null;
  const rules = Array.isArray(body?.rules) ? body.rules.filter((r): r is string => typeof r === "string").slice(0, 10).map((r) => r.slice(0, 300)) : [];
  if (!body?.plan || !Array.isArray(body.sessions)) return NextResponse.json({ error: "Missing data" }, { status: 400 });
  const recovery = body.recovery && typeof body.recovery === "object" ? body.recovery : null;
  const muscleSets = body.muscleSets && typeof body.muscleSets === "object" ? body.muscleSets : null;
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 20) : [];
  const text = JSON.stringify({ weeksTraining: body.weeksTraining ?? null, currentPlan: body.plan, muscleSets, recentSessions: body.sessions.slice(0, 30), recovery, rows });
  if (text.length > 60_000) return NextResponse.json({ error: "Too much data" }, { status: 413 });

  try {
    const res = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(Review) },
      messages: [{ role: "user", content: `${rules.length ? `The lifter's rules (always follow these):\n- ${rules.join("\n- ")}\n\n` : ""}Here is the lifter's current plan and their sessions from the last four weeks (newest first; sets are weight x reps, with the reps-in-reserve rating when given: easy 4+, good 2-3, hard 0-1).\n\n${text}` }],
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
