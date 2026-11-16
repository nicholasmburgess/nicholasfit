import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server/auth";
import { hasSupabase } from "@/lib/supabase/config";
import { syncWithings, withingsConfigured } from "@/lib/server/withings";

export const maxDuration = 30;

/** GET: connection status. POST: pull new weigh-ins. */
async function handle(doSync: boolean) {
  if (!hasSupabase) return NextResponse.json({ available: false });
  const db = await serverSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!withingsConfigured()) return NextResponse.json({ available: false });
  try {
    if (!doSync) {
      const { data: link, error } = await db.from("withings_links").select("last_sync").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ available: true, connected: Boolean(link), lastSync: link?.last_sync ?? null });
    }
    return NextResponse.json({ available: true, ...(await syncWithings(db)) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    if (/relation .* does not exist|Could not find the table/i.test(msg)) return NextResponse.json({ available: true, connected: false, error: "Run supabase/migrations/0003_withings.sql in Supabase first." });
    return NextResponse.json({ available: true, connected: true, error: "Couldn't sync with Withings. Try reconnecting." }, { status: 502 });
  }
}

export const GET = () => handle(false);
export const POST = () => handle(true);
