import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import type { Plan } from "@/lib/plan";
import type { Workout } from "@/lib/types";

/**
 * Offline-first workout storage for the native workout screen.
 *
 * Everything is saved on the phone first and synced to Supabase when there is signal, one send
 * per workout at a time with the newest version (the same rules as the website's outbox).
 * The website hands over the sign-in, the training plan and recent history whenever it loads,
 * so a workout can be started and logged with no signal at all.
 */

export type Session = { url: string; anonKey: string; accessToken: string; refreshToken: string; expiresAt: number };
export type Snapshot = { plan: Plan; history: Workout[]; savedAt: string; birthYear?: number | null };

const K = { session: "nf.session.v1", snapshot: "nf.snapshot.v1", workouts: "nf.workouts.v1", outbox: "nf.outbox.v1" };

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

// Every read-modify-write of local storage runs one at a time, so quick taps can't overwrite each other.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

export const getSession = () => read<Session | null>(K.session, null);
export const saveSession = (s: Session) => write(K.session, s);
export const getSnapshot = () => read<Snapshot | null>(K.snapshot, null);
export function saveSnapshot(s: Snapshot) {
  return serial(() => saveSnapshotNow(s));
}
async function saveSnapshotNow(s: Snapshot) {
  // Keep finished workouts the phone hasn't synced yet, so offline history stays complete.
  const local = Object.values(await read<Record<string, Workout>>(K.workouts, {})).filter((w) => w.finishedAt);
  const ids = new Set(s.history.map((w) => w.id));
  // A snapshot sent without the birth year (e.g. when starting a workout) keeps the one we have.
  const birthYear = s.birthYear ?? (await read<Snapshot | null>(K.snapshot, null))?.birthYear ?? null;
  await write(K.snapshot, { ...s, birthYear, history: [...local.filter((w) => !ids.has(w.id)), ...s.history] });
}

export async function getWorkout(id: string): Promise<Workout | null> {
  return (await read<Record<string, Workout>>(K.workouts, {}))[id] ?? null;
}

/** The unfinished workout on this phone, if any (newest first). */
export async function activeWorkout(): Promise<Workout | null> {
  const all = Object.values(await read<Record<string, Workout>>(K.workouts, {}));
  return all.filter((w) => !w.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

/** Finished workouts still on the phone (not yet synced or handed over). */
export async function localFinished(): Promise<Workout[]> {
  return Object.values(await read<Record<string, Workout>>(K.workouts, {})).filter((w) => w.finishedAt);
}

export async function pendingCount(): Promise<number> {
  return Object.keys(await read<Record<string, number>>(K.outbox, {})).length;
}

let rev = Date.now();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<(pending: number) => void>();
export function onSyncChange(fn: (pending: number) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const announce = async () => {
  const n = await pendingCount();
  listeners.forEach((fn) => fn(n));
};

/** Save on the phone now; sync in the background. Never throws for lack of signal. */
export async function saveWorkout(w: Workout) {
  await serial(async () => {
    const all = await read<Record<string, Workout>>(K.workouts, {});
    all[w.id] = w;
    await write(K.workouts, all);
    const box = await read<Record<string, number>>(K.outbox, {});
    box[w.id] = ++rev;
    await write(K.outbox, box);
  });
  announce();
  push(w.id).catch(() => {});
}

export async function freshSession(): Promise<Session | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.expiresAt * 1000 - Date.now() > 60_000) return s;
  const res = await fetch(`${s.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: s.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refreshToken }),
  });
  if (!res.ok) throw new Error(`Sign-in expired (${res.status}). Open the app with signal to refresh it.`);
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_at?: number; expires_in: number };
  const next = { ...s, accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: j.expires_at ?? Math.floor(Date.now() / 1000) + j.expires_in };
  await saveSession(next);
  return next;
}

async function upsert(w: Workout) {
  const s = await freshSession();
  if (!s) throw new Error("Not signed in yet");
  const res = await fetch(`${s.url}/rest/v1/workouts`, {
    method: "POST",
    headers: {
      apikey: s.anonKey,
      Authorization: `Bearer ${s.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: w.id,
      name: w.name,
      template_key: w.templateKey,
      started_at: w.startedAt,
      finished_at: w.finishedAt,
      entries: w.entries,
      notes: w.notes,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
}

function push(id: string): Promise<void> {
  const running = inFlight.get(id);
  if (running) return running; // it re-reads the outbox when done, so it will send this version too
  const job = (async () => {
    for (;;) {
      const box = await read<Record<string, number>>(K.outbox, {});
      const r = box[id];
      if (r == null) return;
      const w = await getWorkout(id);
      if (!w) {
        await serial(async () => {
          const b = await read<Record<string, number>>(K.outbox, {});
          delete b[id];
          await write(K.outbox, b);
        });
        return;
      }
      await upsert(w);
      const sent = await serial(async () => {
        const after = await read<Record<string, number>>(K.outbox, {});
        if (after[id] !== r) return false;
        delete after[id];
        await write(K.outbox, after);
        return true;
      });
      if (sent) {
        if (w.finishedAt) await settle(w);
        return;
      }
    }
  })().finally(() => {
    inFlight.delete(id);
    announce();
  });
  inFlight.set(id, job);
  return job;
}

/** A finished workout that reached the server moves into history and off the phone's active list. */
function settle(w: Workout) {
  return serial(async () => {
    const snap = await getSnapshot();
    if (snap) await write(K.snapshot, { ...snap, history: [w, ...snap.history.filter((x) => x.id !== w.id)] });
    const all = await read<Record<string, Workout>>(K.workouts, {});
    delete all[w.id];
    await write(K.workouts, all);
  });
}

export async function flushAll() {
  const box = await read<Record<string, number>>(K.outbox, {});
  for (const id of Object.keys(box)) await push(id).catch(() => {});
}

setInterval(() => {
  pendingCount().then((n) => {
    if (n) flushAll();
  });
}, 20_000);
AppState.addEventListener("change", (s) => {
  if (s === "active") flushAll();
});

/** Hand a workout over to the website (or drop it): stop syncing it from the phone and forget the local copy. */
export async function release(w: Workout) {
  await inFlight.get(w.id)?.catch(() => {});
  await serial(async () => {
    const all = await read<Record<string, Workout>>(K.workouts, {});
    delete all[w.id];
    await write(K.workouts, all);
    const box = await read<Record<string, number>>(K.outbox, {});
    delete box[w.id];
    await write(K.outbox, box);
    if (!w.finishedAt) return;
    const snap = await getSnapshot();
    if (snap) await write(K.snapshot, { ...snap, history: [w, ...snap.history.filter((x) => x.id !== w.id)] });
  });
  announce();
}

/** Best-effort delete on the server for a workout discarded with no website open. */
export async function deleteRemote(id: string) {
  try {
    const s = await freshSession();
    if (!s) return;
    await fetch(`${s.url}/rest/v1/workouts?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: s.anonKey, Authorization: `Bearer ${s.accessToken}` },
    });
  } catch {
    // No signal: nothing to delete yet if it never synced.
  }
}
