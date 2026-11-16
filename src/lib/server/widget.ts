import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "@/lib/supabase/config";

/** Widget requests carry the personal key as "Authorization: Bearer <key>". */
export function widgetToken(req: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{32,128})$/.exec(req.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

/** Plain Supabase client (no login). The widget_* database functions check the key themselves. */
export function anonSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function widgetError(error: { code?: string; message?: string } | null) {
  if (error?.code === "28000") return NextResponse.json({ error: "Widget key not recognised. Make a new one in the app." }, { status: 401 });
  if (error?.code === "PGRST202" || error?.code === "42883")
    return NextResponse.json({ error: "Widget isn't set up in the database yet (run 0005_widget.sql)." }, { status: 503 });
  return NextResponse.json({ error: "Couldn't load your data" }, { status: 500 });
}

export function guard(req: Request): string | NextResponse {
  if (!hasSupabase) return NextResponse.json({ error: "Widgets need the Supabase-connected app" }, { status: 503 });
  return widgetToken(req) ?? NextResponse.json({ error: "Missing widget key" }, { status: 401 });
}
