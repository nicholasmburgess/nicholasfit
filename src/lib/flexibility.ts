import { ROUTINES, getLevel } from "./stretches";
import { hasSupabase } from "./supabase/config";
import { supabase } from "./supabase/client";

/**
 * Everything the Flexibility tab remembers: stretch sessions, self-tests, the intensity level for
 * each routine, and Claude's latest review. Small, so it lives as one JSON document per user
 * (table `flexibility`, 0008_flexibility.sql), with a copy on the phone so it works before that
 * table exists and with no signal.
 */

export type Feel = "easy" | "good" | "hard";
export type FlexSession = { id: string; at: string; routine: string; level: number; seconds: number; completed: boolean; feel?: Feel };

export type TestKind = "sitReach" | "kneeWall" | "backScratch";
/** Centimetres, higher is always better. Two-sided tests store left and right. */
export type FlexTest = { id: string; at: string; kind: TestKind; value?: number; left?: number; right?: number };

export type FlexReview = {
  at: string;
  summary: string;
  focus: string[];
  suggestions: { routine: string; level: number; reason: string }[];
};

export type FlexData = {
  sessions: FlexSession[];
  tests: FlexTest[];
  levels: Record<string, number>;
  review: FlexReview | null;
  updatedAt: string;
};

export const EMPTY: FlexData = { sessions: [], tests: [], levels: {}, review: null, updatedAt: new Date(0).toISOString() };

export const TESTS: Record<TestKind, { name: string; sides: boolean; area: string; how: string[]; unit: string; hint: string }> = {
  sitReach: {
    name: "Sit and reach", sides: false, area: "Hamstrings and lower back", unit: "cm",
    how: [
      "Warm up first (a few minutes on the rower is ideal)",
      "Sit with legs straight, feet flat against a box or the bench upright",
      "Lay a tape measure along your legs with 0 at the soles of your feet",
      "Reach forward slowly with both hands together, hold 2 seconds",
      "Best of 3. Short of your toes is negative (−8), past them is positive (+5)",
    ],
    hint: "Short of toes is negative",
  },
  kneeWall: {
    name: "Knee to wall", sides: true, area: "Ankles (squat depth)", unit: "cm",
    how: [
      "Face a wall barefoot in a half-kneeling or split stance",
      "Push the front knee forward to touch the wall, heel flat on the floor",
      "Slide the foot back until the knee only just touches with the heel still down",
      "Measure from big toe to wall. Best of 3, each side",
      "About 10 cm or more is plenty for a deep squat",
    ],
    hint: "Toe to wall distance",
  },
  backScratch: {
    name: "Back scratch", sides: true, area: "Shoulders", unit: "cm",
    how: [
      "Reach one hand over your shoulder and down your back, palm in",
      "Reach the other hand up your back from below, palm out",
      "Measure the gap between your middle fingertips",
      "A gap is negative (−6), overlapping is positive (+3)",
      "The side is the hand on top. Best of 2, each side",
    ],
    hint: "Gap is negative",
  },
};

const KEY = "nicholasfit.flexibility.v1";

function readLocal(): FlexData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<FlexData>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeLocal(d: FlexData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage full or blocked: the cloud copy still saves.
  }
}

async function readRemote(): Promise<FlexData | null> {
  if (!hasSupabase) return null;
  const { data, error } = await supabase().from("flexibility").select("data, updated_at").maybeSingle();
  if (error || !data) return null;
  return { ...EMPTY, ...(data.data as Partial<FlexData>), updatedAt: data.updated_at as string };
}

let tableMissing = false;

async function writeRemote(d: FlexData): Promise<void> {
  if (!hasSupabase || tableMissing) return;
  const { data: u } = await supabase().auth.getUser();
  if (!u.user) return;
  const { error } = await supabase().from("flexibility").upsert({ user_id: u.user.id, data: d, updated_at: d.updatedAt });
  if (error && /flexibility/.test(error.message)) tableMissing = true;
}

/** Combines the phone copy and the cloud copy so nothing logged offline is lost. */
function merge(a: FlexData, b: FlexData): FlexData {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const byId = <T extends { id: string }>(x: T[], y: T[]) => [...new Map([...x, ...y].map((i) => [i.id, i])).values()];
  return {
    ...newer,
    sessions: byId(b.sessions, a.sessions).sort((p, q) => q.at.localeCompare(p.at)),
    tests: byId(b.tests, a.tests).sort((p, q) => q.at.localeCompare(p.at)),
  };
}

export const flexStore = {
  local: readLocal,
  async load(): Promise<FlexData> {
    const local = readLocal();
    try {
      const remote = await readRemote();
      if (!remote) return local;
      const merged = merge(local, remote);
      writeLocal(merged);
      if (merged.updatedAt > remote.updatedAt || merged.sessions.length > remote.sessions.length || merged.tests.length > remote.tests.length) {
        void writeRemote(merged).catch(() => {});
      }
      return merged;
    } catch {
      return local;
    }
  },
  /** Applies a change to the latest saved copy and saves it on the phone, then in the cloud. */
  async update(fn: (d: FlexData) => FlexData): Promise<FlexData> {
    const next = { ...fn(readLocal()), updatedAt: new Date().toISOString() };
    writeLocal(next);
    await writeRemote(next).catch(() => {});
    return next;
  },
  get needsTable() {
    return tableMissing;
  },
};

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export const levelFor = (d: FlexData, routine: string) => getLevel(d.levels[routine] ?? 1).n;

/**
 * Suggests a level change from how the last sessions felt, the same way set ratings move weights:
 * two "easy" in a row at this level means go up, one "hard" means come down. Only a suggestion;
 * the lifter decides when.
 */
export function levelHint(d: FlexData, routine: string): { to: number; why: string } | null {
  const level = levelFor(d, routine);
  const recent = d.sessions.filter((s) => s.routine === routine && s.level === level && s.feel).slice(0, 2);
  if (recent[0]?.feel === "hard" && level > 1) return { to: level - 1, why: "Last time felt hard." };
  if (recent.length === 2 && recent.every((s) => s.feel === "easy") && level < 4) return { to: level + 1, why: "The last two felt easy." };
  return null;
}

/** Minutes stretched in each of the last `weeks` weeks (Monday start), oldest first. For the chart only. */
export function minutesByWeek(sessions: FlexSession[], weeks = 8, now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday);
    start.setDate(start.getDate() - 7 * (weeks - 1 - i));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const secs = sessions.filter((s) => new Date(s.at) >= start && new Date(s.at) < end).reduce((t, s) => t + s.seconds, 0);
    return { label: start.toLocaleDateString("en-AU", { day: "numeric", month: "short" }), value: Math.round(secs / 60) };
  });
}

export function daysSince(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const a = new Date(iso);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** A test's single score (two-sided tests average both sides) so trends are easy to read. */
export function testScore(t: FlexTest): number | null {
  if (t.value != null) return t.value;
  const sides = [t.left, t.right].filter((v): v is number => v != null);
  return sides.length ? sides.reduce((a, b) => a + b, 0) / sides.length : null;
}

/** What Claude gets for its review: compact and only the last 120 days. */
export function reviewInput(d: FlexData, now = new Date()) {
  const cutoff = new Date(now.getTime() - 120 * 86_400_000).toISOString();
  return {
    today: now.toISOString().slice(0, 10),
    levels: Object.fromEntries(ROUTINES.filter((r) => !r.fixed).map((r) => [r.key, levelFor(d, r.key)])),
    sessions: d.sessions
      .filter((s) => s.at >= cutoff)
      .slice(0, 80)
      .map((s) => ({ date: s.at.slice(0, 10), routine: s.routine, level: s.level, minutes: Math.round(s.seconds / 6) / 10, finished: s.completed, felt: s.feel ?? null })),
    tests: d.tests.slice(0, 40).map((t) => ({ date: t.at.slice(0, 10), test: t.kind, value: t.value ?? null, left: t.left ?? null, right: t.right ?? null })),
    previousReview: d.review ? { date: d.review.at.slice(0, 10), summary: d.review.summary } : null,
  };
}
