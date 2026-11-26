import { DEFAULT_PLAN, DEFAULT_RULES, upgradePlan, type Plan } from "./plan";
import { hasSupabase } from "./supabase/config";
import { supabase } from "./supabase/client";

const KEY = "nicholasfit.plan.v1";

function withDefaults(p: Partial<Plan>): Plan {
  // A saved plan from before versioning counts as version 1, so it gets the built-in updates once.
  return upgradePlan({ ...DEFAULT_PLAN, version: 1, ...p, rules: p.rules ?? DEFAULT_RULES });
}

export const planStore = {
  async get(): Promise<Plan> {
    try {
      if (!hasSupabase) {
        const raw = localStorage.getItem(KEY);
        return raw ? withDefaults(JSON.parse(raw) as Partial<Plan>) : DEFAULT_PLAN;
      }
      const { data, error } = await supabase().from("training_plans").select("plan").maybeSingle();
      if (error || !data) return DEFAULT_PLAN;
      return withDefaults(data.plan as Partial<Plan>);
    } catch {
      return DEFAULT_PLAN;
    }
  },
  async save(plan: Plan): Promise<void> {
    if (!hasSupabase) {
      localStorage.setItem(KEY, JSON.stringify(plan));
      return;
    }
    const { data } = await supabase().auth.getUser();
    const { error } = await supabase().from("training_plans").upsert({ user_id: data.user?.id, plan, updated_at: new Date().toISOString() });
    if (error) throw new Error(/training_plans/.test(error.message) ? "Run 0006_plan.sql in Supabase first." : error.message);
  },
};
