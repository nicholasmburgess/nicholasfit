export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Without Supabase settings the app runs in demo mode and keeps data in this browser only. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
