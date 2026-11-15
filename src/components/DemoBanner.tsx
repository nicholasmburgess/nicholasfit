import { hasSupabase } from "@/lib/supabase/config";

export function DemoBanner() {
  if (hasSupabase) return null;
  return (
    <p className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
      Demo mode: workouts are saved in this browser only. Connect Supabase to sync and keep them safe.
    </p>
  );
}
