import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server/auth";
import { exchangeCode, linkRow, syncWithings } from "@/lib/server/withings";

/** Withings sends the user back here after they approve access. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/progress?withings=${status}`, req.url));
    res.cookies.delete("withings_state");
    return res;
  };
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = (await cookies()).get("withings_state")?.value;
  if (!code || !state || state !== expected) return done("failed");

  try {
    const db = await serverSupabase();
    const { data } = await db.auth.getUser();
    if (!data.user) return done("failed");
    const t = await exchangeCode(code);
    const { error } = await db.from("withings_links").upsert({ user_id: data.user.id, ...linkRow(t) });
    if (error) throw error;
    await syncWithings(db);
    return done("connected");
  } catch (e) {
    console.error("Withings callback", e);
    return done("failed");
  }
}
