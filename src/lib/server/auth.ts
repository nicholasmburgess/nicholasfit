import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";

/** True when the request comes from a signed-in user (always true in demo mode). */
export async function isSignedIn(): Promise<boolean> {
  if (!hasSupabase) return true;
  const store = await cookies();
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data } = await client.auth.getUser();
  return Boolean(data.user);
}
