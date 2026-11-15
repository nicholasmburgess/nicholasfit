import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSignedIn } from "@/lib/server/auth";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const Estimate = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Short food name, e.g. 'Chicken breast'"),
      portion: z.string().describe("Estimated amount, e.g. '150 g' or '1 cup'"),
      kcal: z.number(),
      protein: z.number().describe("grams"),
      carbs: z.number().describe("grams"),
      fat: z.number().describe("grams"),
    }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
  note: z.string().describe("One short sentence: the main assumption, or what would make the estimate more accurate. Empty if nothing useful."),
});

const SYSTEM = `You estimate the nutrition of meals for a personal fitness app. The user is in Australia and does not weigh food, so you get a photo, a short description, or both.

Break the meal into its main components and estimate a realistic portion for each from visual cues (plate size, cutlery, hands, packaging) or typical Australian serving sizes. Include cooking oil, sauces, dressings and drinks when they are visible or mentioned, because these are the most commonly missed calories. If the description gives amounts or brands, trust them over the photo.

Use standard food composition values. Give whole numbers for kcal and grams to one decimal at most. Set confidence to low when the portion or ingredients are mostly guesswork. If the image is not food, return no items and say so in the note.`;

function client() {
  return new Anthropic();
}

/** GET: is the Claude key set and working? */
export async function GET() {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, reason: "ANTHROPIC_API_KEY is not set in Vercel" });
  try {
    await client().models.retrieve(MODEL);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return NextResponse.json({ ok: false, reason: status === 401 ? "The key was rejected. Check it in Vercel." : "Couldn't reach Claude" });
  }
}

/** POST { description?: string, image?: base64 JPEG } -> estimated items and totals. */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI estimates aren't set up yet (no ANTHROPIC_API_KEY in Vercel)." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { description?: string; image?: string } | null;
  const description = (body?.description ?? "").slice(0, 1000).trim();
  const image = body?.image?.replace(/^data:image\/\w+;base64,/, "");
  if (!description && !image) return NextResponse.json({ error: "Add a photo or a description" }, { status: 400 });
  if (image && image.length > 6_000_000) return NextResponse.json({ error: "Photo is too large" }, { status: 413 });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  content.push({ type: "text", text: description ? `Meal: ${description}` : "Estimate this meal." });

  try {
    const res = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(Estimate) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return NextResponse.json({ error: "Couldn't estimate that one. Try describing it in words." }, { status: 422 });
    }
    const est = res.parsed_output;
    const sum = (k: "kcal" | "protein" | "carbs" | "fat") => Math.round(est.items.reduce((s, i) => s + i[k], 0));
    return NextResponse.json({
      items: est.items,
      kcal: sum("kcal"),
      protein: sum("protein"),
      carbs: sum("carbs"),
      fat: sum("fat"),
      confidence: est.confidence,
      note: est.note,
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg =
        e.status === 401 ? "The Claude key was rejected. Check ANTHROPIC_API_KEY in Vercel." :
        e.status === 429 ? "Too many requests right now. Try again in a minute." :
        e.status === 400 && /credit|billing/i.test(e.message) ? "Your Claude account is out of credit." :
        "Claude had a problem. Try again.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
