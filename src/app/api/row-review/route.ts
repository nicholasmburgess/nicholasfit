import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ROW_SESSIONS } from "@/lib/row-sessions";
import { isSignedIn } from "@/lib/server/auth";
import { MODEL, claude } from "@/lib/server/estimate";

export const maxDuration = 120;

const KEYS = ROW_SESSIONS.map((s) => s.key) as [string, ...string[]];

const Review = z.object({
  summary: z.string().describe("Two or three plain sentences to the rower about this session: what went well, what the numbers show, and what to do next time."),
  nextTargetSplitS: z.number().describe("Target average split for the hard parts of this same session next time, in seconds per 500 m (e.g. 124.5 for 2:04.5)."),
  targetNote: z.string().describe("One short line shown before the next session of this type, e.g. 'Hold 2:04 for every rep before going faster.'"),
  unlockFourByFour: z.boolean().describe("True when the rower is ready for the 4 x 4 session (or already has it)."),
});

const SESSIONS = ROW_SESSIONS.map((s) => `${s.key}: ${s.name}. ${s.description}`).join("\n");

const SYSTEM = `You coach guided indoor rowing sessions on a Concept2 rower inside a personal fitness app. The rower is a beginner who also does three full-body strength sessions a week, aiming to lose fat while gaining muscle and improve general fitness. After each harder row you review it and set the target split for the hard parts next time.

Sessions:
${SESSIONS}

Apply current evidence:
- Progress gradually. If every hard rep was at or faster than the target with heart rate in the session's zone, move the target 1 to 2 seconds faster per 500 m. If reps were mostly on target but the last ones slowed by more than about 2 seconds, keep the same target. If the rower missed the target on most reps, or heart rate went above the session's zone early, make the target 2 to 3 seconds slower. Never change it by more than 3 seconds at once.
- Even pacing matters more than one fast rep: a first rep well faster than the rest followed by a fade is a pacing mistake, not fitness. Say so kindly.
- Heart rate lags effort by a minute or more, so on 1-minute reps the early reps rarely reach zone 4; judge by the later reps. On 4-minute and 6-minute pieces it should reach the target zone by the second half of each piece.
- Heart rate coming down 20 or more beats in the easy minutes after a rep is a good sign of fitness; small drops late in the session are normal fatigue.
- Heart-rate drift upward across reps at the same split, with sleep or resting heart rate worse than usual, points to fatigue: hold the target rather than progress.
- The 4 x 4 (85 to 95% of max heart rate for four minutes, Helgerud 2007) is the hardest. Unlock it after at least three harder rows completed with steady pacing, or keep it unlocked if it already is.
- One harder row a week, on a day without lifting, is enough alongside three strength sessions; more cardio intensity cuts into strength gains (Wilson 2012). Mention this only if their log shows more than one harder row in the past seven days.
- The target split must stay within 8 seconds of what they actually averaged on the hard reps this time.

Splits are seconds per 500 m (lower is faster). Write in plain, encouraging but factual Australian English. No jargon, no medical claims.`;

/** POST { row, recent, easySplitS, zones, recovery, harderRowsDone, unlocked } -> review (nothing is saved here). */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Claude needs ANTHROPIC_API_KEY in Vercel." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { row?: { session?: string; reps?: { splitS?: number | null }[] } } | null;
  if (!body?.row?.session || !KEYS.includes(body.row.session) || !Array.isArray(body.row.reps)) return NextResponse.json({ error: "Missing data" }, { status: 400 });
  const text = JSON.stringify(body);
  if (text.length > 40_000) return NextResponse.json({ error: "Too much data" }, { status: 413 });

  try {
    const res = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: betaZodOutputFormat(Review) },
      messages: [{ role: "user", content: `Here is the row I just finished, my recent harder rows (newest first), my easy-row split, my heart-rate zones and recent recovery data.\n\n${text}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return NextResponse.json({ error: "Couldn't review this row. Try again later." }, { status: 422 });
    const out = res.parsed_output;
    // Keep the target sensible whatever comes back: within 8 s of this session's average hard split.
    const splits = body.row.reps.map((r) => r.splitS).filter((x): x is number => typeof x === "number");
    const avg = splits.length ? splits.reduce((a, b) => a + b, 0) / splits.length : null;
    const target = avg ? Math.min(avg + 8, Math.max(avg - 8, out.nextTargetSplitS)) : out.nextTargetSplitS;
    return NextResponse.json({ summary: out.summary, nextTargetSplitS: Math.round(target * 10) / 10, targetNote: out.targetNote.slice(0, 160), unlockFourByFour: out.unlockFourByFour });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = e.status === 429 ? "Too many requests right now. Try again in a minute." : e.status === 401 ? "The Claude key was rejected." : "Claude had a problem. Try again.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
