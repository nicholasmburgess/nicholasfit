import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = "claude-opus-5-5";

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

Photo-based estimates are known to under-count energy by about a third, mostly from hidden fat, so when a portion or added fat is uncertain, pick the higher plausible amount rather than the lower one. Use standard food composition values. Give whole numbers for kcal and grams to one decimal at most. Set confidence to low when the portion or ingredients are mostly guesswork. If the image is not food, return no items and say so in the note.`;

export function claude() {
  return new Anthropic();
}

export type EstimateResult =
  | { ok: true; data: { items: z.infer<typeof Estimate>["items"]; kcal: number; protein: number; carbs: number; fat: number; confidence: string; note: string } }
  | { ok: false; status: number; error: string };

/** Estimate a meal from a description and/or base64 JPEG. Shared by the app and the widget. */
export async function estimateMeal(input: { description?: string; image?: string } | null): Promise<EstimateResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, status: 503, error: "AI estimates aren't set up yet (no ANTHROPIC_API_KEY in Vercel)." };
  const description = (input?.description ?? "").slice(0, 1000).trim();
  const image = input?.image?.replace(/^data:image\/\w+;base64,/, "");
  if (!description && !image) return { ok: false, status: 400, error: "Add a photo or a description" };
  if (image && image.length > 6_000_000) return { ok: false, status: 413, error: "Photo is too large" };

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  content.push({ type: "text", text: description ? `Meal: ${description}` : "Estimate this meal." });

  try {
    const res = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(Estimate) },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return { ok: false, status: 422, error: "Couldn't estimate that one. Try describing it in words." };
    }
    const est = res.parsed_output;
    const sum = (k: "kcal" | "protein" | "carbs" | "fat") => Math.round(est.items.reduce((s, i) => s + i[k], 0));
    return {
      ok: true,
      data: { items: est.items, kcal: sum("kcal"), protein: sum("protein"), carbs: sum("carbs"), fat: sum("fat"), confidence: est.confidence, note: est.note },
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg =
        e.status === 401 ? "The Claude key was rejected. Check ANTHROPIC_API_KEY in Vercel." :
        e.status === 429 ? "Too many requests right now. Try again in a minute." :
        e.status === 400 && /credit|billing/i.test(e.message) ? "Your Claude account is out of credit." :
        "Claude had a problem. Try again.";
      return { ok: false, status: 502, error: msg };
    }
    return { ok: false, status: 500, error: "Something went wrong. Try again." };
  }
}
