import type { Workout } from "@/lib/types";
import type { Store } from ".";

const KEY = "nicholasfit.workouts.v1";

function readAll(): Workout[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Workout[];
  } catch {
    return [];
  }
}

function writeAll(ws: Workout[]) {
  localStorage.setItem(KEY, JSON.stringify(ws));
}

export const localStore: Store = {
  async listWorkouts() {
    return readAll().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },
  async getWorkout(id) {
    return readAll().find((w) => w.id === id) ?? null;
  },
  async saveWorkout(w) {
    const all = readAll().filter((x) => x.id !== w.id);
    writeAll([...all, w]);
  },
  async deleteWorkout(id) {
    writeAll(readAll().filter((x) => x.id !== id));
  },
};
