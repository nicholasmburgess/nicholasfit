import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";

/** Supabase client acting as the signed-in user (row-level security applies). */
export async function serverSupabase(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a context that can't set cookies; the middleware refreshes the session anyway.
        }
      },
    },
  });
}

/** True when the request comes from a signed-in user (always true in demo mode). */
export async function isSignedIn(): Promise<boolean> {
  if (!hasSupabase) return true;
  const { data } = await (await serverSupabase()).auth.getUser();
  return Boolean(data.user);
}
