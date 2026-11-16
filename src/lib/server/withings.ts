import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const WITHINGS_REDIRECT_URI = process.env.WITHINGS_REDIRECT_URI ?? "https://nicholasfit.vercel.app/api/withings/callback";
const TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const MEASURE_URL = "https://wbsapi.withings.net/measure";

export const withingsConfigured = () => Boolean(process.env.WITHINGS_CLIENT_ID && process.env.WITHINGS_CLIENT_SECRET);

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.WITHINGS_CLIENT_ID!,
    scope: "user.metrics",
    redirect_uri: WITHINGS_REDIRECT_URI,
    state,
  });
  return `https://account.withings.com/oauth2_user/authorize2?${q}`;
}

type TokenBody = { userid: string | number; access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(params: Record<string, string>): Promise<TokenBody> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "requesttoken",
      client_id: process.env.WITHINGS_CLIENT_ID!,
      client_secret: process.env.WITHINGS_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = (await res.json()) as { status: number; body: TokenBody; error?: string };
  if (json.status !== 0) throw new Error(`Withings token error ${json.status}${json.error ? `: ${json.error}` : ""}`);
  return json.body;
}

export const exchangeCode = (code: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: WITHINGS_REDIRECT_URI });
const refresh = (refresh_token: string) => tokenRequest({ grant_type: "refresh_token", refresh_token });

export function linkRow(t: TokenBody) {
  return {
    withings_userid: String(t.userid),
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Deterministic UUID per Withings measurement group, so re-syncing never duplicates a weigh-in. */
function groupUuid(grpid: number | string): string {
  const h = createHash("sha1").update(`withings:${grpid}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type Group = { grpid: number; date: number; measures: { value: number; type: number; unit: number }[] };

/** Pulls new weigh-ins since the last sync into body_weights. Returns how many were added or updated. */
export async function syncWithings(db: SupabaseClient): Promise<{ connected: boolean; added: number; lastSync: string | null }> {
  const { data: link, error } = await db.from("withings_links").select("*").maybeSingle();
  if (error) throw error;
  if (!link) return { connected: false, added: 0, lastSync: null };

  let token = link.access_token as string;
  if (Date.parse(link.expires_at) < Date.now()) {
    const t = await refresh(link.refresh_token);
    token = t.access_token;
    await db.from("withings_links").update(linkRow(t)).eq("user_id", link.user_id);
  }

  // First sync: the last year. Afterwards: everything changed since the last sync (with a day of overlap).
  const since = link.last_sync ? Math.floor(Date.parse(link.last_sync) / 1000) - 86400 : Math.floor(Date.now() / 1000) - 365 * 86400;
  const groups: Group[] = [];
  let offset: number | undefined;
  for (let page = 0; page < 20; page++) {
    const body = new URLSearchParams({ action: "getmeas", meastypes: "1,6", category: "1", lastupdate: String(since) });
    if (offset) body.set("offset", String(offset));
    const res = await fetch(MEASURE_URL, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
    const json = (await res.json()) as { status: number; body: { measuregrps: Group[]; more?: number; offset?: number } };
    if (json.status !== 0) throw new Error(`Withings measure error ${json.status}`);
    groups.push(...json.body.measuregrps);
    if (!json.body.more) break;
    offset = json.body.offset;
  }

  const val = (g: Group, type: number) => {
    const m = g.measures.find((x) => x.type === type);
    return m ? Math.round(m.value * 10 ** m.unit * 10) / 10 : null;
  };
  // Body fat sometimes arrives in its own group a few seconds after the weight; attach it to the nearest weigh-in.
  const fatOnly = groups.filter((g) => val(g, 1) == null && val(g, 6) != null);
  const rows = groups
    .filter((g) => val(g, 1) != null)
    .map((g) => {
      const near = fatOnly.find((f) => Math.abs(f.date - g.date) <= 300);
      return {
        id: groupUuid(g.grpid),
        measured_at: new Date(g.date * 1000).toISOString(),
        kg: val(g, 1)!,
        fat_pct: val(g, 6) ?? (near ? val(near, 6) : null),
        source: "withings",
      };
    });

  if (rows.length) {
    const { error: e } = await db.from("body_weights").upsert(rows);
    if (e) throw e;
  }
  const lastSync = new Date().toISOString();
  await db.from("withings_links").update({ last_sync: lastSync }).eq("user_id", link.user_id);
  return { connected: true, added: rows.length, lastSync };
}
