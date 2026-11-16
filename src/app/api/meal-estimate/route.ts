import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/server/auth";
import { MODEL, claude, estimateMeal } from "@/lib/server/estimate";

export const maxDuration = 60;

/** GET: is the Claude key set and working? */
export async function GET() {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, reason: "ANTHROPIC_API_KEY is not set in Vercel" });
  try {
    await claude().models.retrieve(MODEL);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return NextResponse.json({ ok: false, reason: status === 401 ? "The key was rejected. Check it in Vercel." : "Couldn't reach Claude" });
  }
}

/** POST { description?: string, image?: base64 JPEG } -> estimated items and totals. */
export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const r = await estimateMeal(await req.json().catch(() => null));
  return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status });
}
