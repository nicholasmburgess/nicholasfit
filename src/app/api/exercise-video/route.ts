import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getExercise } from "@/lib/exercises";
import { isSignedIn } from "@/lib/server/auth";
import { getStretch } from "@/lib/stretches";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";

/**
 * Looks up a short ExerciseDB (AscendAPI) demo clip for one of our exercises and returns its video
 * link, so the iPhone app can stream it. The RapidAPI key stays here on the server.
 *
 * ExerciseDB's terms forbid caching their content, so nothing is stored: every request asks the API
 * again, responses are marked no-store, and the app streams the clip without saving it.
 */
const HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

/** Names ExerciseDB knows better than ours, where fuzzy search would otherwise pick a variant. */
const SEARCH_AS: Record<string, string> = {
  Barbell_Squat: "barbell full squat",
  "Barbell_Bench_Press_-_Medium_Grip": "barbell bench press",
  Seated_Cable_Rows: "cable seated row",
  Romanian_Deadlift: "barbell romanian deadlift",
  Barbell_Deadlift: "barbell deadlift",
};

const noStore = { "Cache-Control": "no-store" };

/** The iPhone app sends its session as a bearer token; the website uses its sign-in cookie. */
async function signedIn(req: Request): Promise<boolean> {
  if (!hasSupabase) return true;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return isSignedIn();
  const { data } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token);
  return Boolean(data.user);
}

async function edb<T>(path: string, key: string): Promise<T | null> {
  const res = await fetch(`https://${HOST}${path}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return res.ok ? ((await res.json()) as T) : null;
}

type Search = { data?: { exerciseId: string; name: string }[] };
type Detail = { data?: { name: string; videoUrl?: string } };

export async function GET(req: Request) {
  const key = process.env.EXERCISEDB_RAPIDAPI_KEY;
  if (!key) return NextResponse.json({ error: "Videos aren't set up yet" }, { status: 503, headers: noStore });
  if (!(await signedIn(req))) return NextResponse.json({ error: "Sign in first" }, { status: 401, headers: noStore });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  const ex = getExercise(id);
  const stretch = ex ? undefined : getStretch(id);
  if (!ex && !stretch) return NextResponse.json({ error: "Unknown exercise" }, { status: 404, headers: noStore });

  try {
    const term = SEARCH_AS[id] ?? stretch?.videoSearch ?? ex?.name ?? "";
    const found = await edb<Search>(`/api/v1/exercises/search?search=${encodeURIComponent(term)}`, key);
    // For a held stretch, only accept a clip that is itself a stretch, so we never loop the wrong move.
    // A stretch can also name the clip it must match, for moves that fuzzy search gets wrong.
    const hit = stretch?.videoMatch
      ? found?.data?.find((h) => stretch.videoMatch!.test(h.name))
      : stretch?.kind === "hold"
        ? found?.data?.find((h) => /stretch|pose/i.test(h.name))
        : found?.data?.[0];
    if (!hit) return NextResponse.json({ video: null }, { headers: noStore });
    const detail = await edb<Detail>(`/api/v1/exercises/${encodeURIComponent(hit.exerciseId)}`, key);
    const video = detail?.data?.videoUrl;
    return NextResponse.json({ video: video ? { url: video, name: detail.data?.name ?? hit.name } : null }, { headers: noStore });
  } catch {
    return NextResponse.json({ video: null }, { status: 502, headers: noStore });
  }
}
