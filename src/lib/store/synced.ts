import type { Workout } from "@/lib/types";
import type { Store } from ".";

/**
 * Local-first wrapper around the Supabase store.
 *
 * - Every save goes to an on-phone outbox first, so a set ticked with no signal is never lost,
 *   even if the app is closed before the signal returns.
 * - Saves for a workout are sent one at a time, always with the newest version, so a slow older
 *   save can't land after (and overwrite) a newer one.
 * - The outbox retries when the phone comes back online, every 20 s, and on next launch.
 * - The last workout list is cached so history and next-session weights still load offline.
 */

const OUTBOX = "nicholasfit.outbox.v1";
const CACHE = "nicholasfit.workoutCache.v1";
export const SYNC_EVENT = "nicholasfit-sync";

type Outbox = Record<string, { workout: Workout; rev: number }>;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage full or blocked: the network save still runs.
  }
};

let rev = Date.now();
const inFlight = new Map<string, Promise<void>>();

export function pendingSync(): number {
  return Object.keys(read<Outbox>(OUTBOX, {})).length;
}
const announce = () => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: pendingSync() }));

const isNetworkError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return /fetch|network|load failed|offline|timed? ?out/i.test(msg) || (typeof navigator !== "undefined" && !navigator.onLine);
};

/**
 * Stop syncing a workout from this page because the iPhone app's workout screen is taking it over,
 * so an older copy here can't later overwrite newer sets logged there.
 */
export async function releaseToNative(id: string) {
  const box = read<Outbox>(OUTBOX, {});
  delete box[id];
  write(OUTBOX, box);
  await inFlight.get(id)?.catch(() => {});
  announce();
}

export function syncedStore(remote: Store): Store {
  /** Sends the newest outbox version of one workout; loops if a newer one arrives meanwhile. */
  function push(id: string): Promise<void> {
    // A send already running re-reads the outbox when it finishes, so it will pick up this version.
    const running = inFlight.get(id);
    if (running) return running;
    const job = (async () => {
      for (;;) {
        const item = read<Outbox>(OUTBOX, {})[id];
        if (!item) return;
        await remote.saveWorkout(item.workout);
        const box = read<Outbox>(OUTBOX, {});
        if (box[id]?.rev === item.rev) {
          delete box[id];
          write(OUTBOX, box);
          return;
        }
        // A newer version was queued while this one was sending: send that too.
      }
    })().finally(() => {
      inFlight.delete(id);
      announce();
    });
    inFlight.set(id, job);
    return job;
  }

  async function flushAll() {
    for (const id of Object.keys(read<Outbox>(OUTBOX, {}))) await push(id).catch(() => {});
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => flushAll());
    setInterval(() => pendingSync() && flushAll(), 20_000);
    setTimeout(() => flushAll(), 1500);
  }

  const overlay = (list: Workout[]) => {
    const box = read<Outbox>(OUTBOX, {});
    const byId = new Map(list.map((w) => [w.id, w]));
    for (const { workout } of Object.values(box)) byId.set(workout.id, workout);
    return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  };

  return {
    async listWorkouts() {
      try {
        const list = await remote.listWorkouts();
        write(CACHE, list);
        return overlay(list);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        return overlay(read<Workout[]>(CACHE, []));
      }
    },
    async getWorkout(id) {
      const queued = read<Outbox>(OUTBOX, {})[id];
      if (queued) return queued.workout;
      try {
        return await remote.getWorkout(id);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        return read<Workout[]>(CACHE, []).find((w) => w.id === id) ?? null;
      }
    },
    async saveWorkout(w) {
      const box = read<Outbox>(OUTBOX, {});
      box[w.id] = { workout: w, rev: ++rev };
      write(OUTBOX, box);
      announce();
      try {
        await push(w.id);
      } catch (e) {
        // Safe in the outbox; it syncs when the signal is back. Only report real errors.
        if (!isNetworkError(e)) throw e;
      }
    },
    async deleteWorkout(id) {
      const box = read<Outbox>(OUTBOX, {});
      delete box[id];
      write(OUTBOX, box);
      await inFlight.get(id)?.catch(() => {});
      await remote.deleteWorkout(id);
      write(CACHE, read<Workout[]>(CACHE, []).filter((w) => w.id !== id));
      announce();
    },
  };
}
