import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/server/auth";
import { MODEL, claude } from "@/lib/server/estimate";
import { LEVELS, ROUTINES, getStretch } from "@/lib/stretches";

export const maxDuration = 120;

const KEYS = ROUTINES.filter((r) => !r.fixed).map((r) => r.key) as [string, ...string[]];

const Review = z.object({
  summary: z.string().describe("Two to four plain sentences to the person about their flexibility progress and what to do next."),
  focus: z.array(z.string()).describe("Up to two body areas to prioritise, e.g. 'Ankles', 'Hamstrings'. Empty if nothing stands out."),
  suggestions: z.array(
    z.object({
      routine: z.enum(KEYS),
      level: z.number().int().min(1).max(LEVELS.length),
      reason: z.string().describe("One short sentence citing what in their log prompted this"),
    }),
  ),
});

const ROUTINE_TEXT = ROUTINES.map((r) => `${r.key} (${r.name}, ${r.when}${r.fixed ? ", moving drills, no levels" : ""}): ${r.steps.map((s) => getStretch(s.id)?.name).join(", ")}`).join("\n");
const LEVEL_TEXT = LEVELS.map((l) => `${l.n} ${l.name}: ${l.hold} s holds per side, tension ${l.tension}`).join("\n");

const SYSTEM = `You review flexibility progress inside a personal fitness app. The person is a 37-year-old male beginner who also lifts weights at home about three times a week, aiming to lose fat and gain muscle. He stretches at his own pace: there is NO weekly target, so never scold him for gaps or count sessions per week against a goal. Instead describe what his log shows and what would help most next.

Apply current evidence on stretching:
- Range of motion improves with accumulated stretching time; roughly 5 minutes per muscle per week across several days gives the largest gains (Thomas et al. 2018). Stretch type matters less than total time (Konrad et al. 2024).
- Strength training through a full range of motion also improves flexibility (Afonso et al. 2021), so lifting counts.
- Held stretches before lifting are fine if under about 60 seconds per muscle, but moving drills are the better warm-up (Behm et al. 2016). Stretching does not prevent muscle soreness (Herbert et al. 2011).
- Progress intensity gradually: move up one level when sessions at the current level feel easy, and down when they feel hard or painful. Never jump more than one level at once.
- Gains in the self-tests usually show over 4 to 8 weeks. Treat changes of 1 to 2 cm as measurement noise.
- Self-tests (centimetres, higher is better): sitReach (hamstrings and lower back, negative = short of toes), kneeWall (ankle dorsiflexion per side; about 10 cm or more is plenty for deep squats), backScratch (shoulder mobility per side, the side named is the hand on top, negative = gap). A left/right difference of more than about 3 cm is worth a little extra work on the tighter side.

Routines:
${ROUTINE_TEXT}

Intensity levels:
${LEVEL_TEXT}

Only suggest a level for a routine when it should change from the current level, and at most two suggestions. If the log is too thin to judge, say so briefly and suggest a test or a first routine. Write in plain, encouraging but factual Australian English, no jargon, no medical claims. If he logs pain, tell him to ease off and see a physio if it persists.`;

/** POST { today, levels, sessions, tests, previousReview } -> { summary, focus, suggestions } (nothing is saved here). */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Claude needs ANTHROPIC_API_KEY in Vercel." }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Missing data" }, { status: 400 });
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
      messages: [{ role: "user", content: `Here is my flexibility log (newest first), my current level for each routine, and my self-test results.\n\n${text}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return NextResponse.json({ error: "Couldn't review this time. Try again later." }, { status: 422 });
    const out = res.parsed_output;
    return NextResponse.json({ summary: out.summary, focus: out.focus.slice(0, 2), suggestions: out.suggestions.slice(0, 2) });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = e.status === 429 ? "Too many requests right now. Try again in a minute." : e.status === 401 ? "The Claude key was rejected." : "Claude had a problem. Try again.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
