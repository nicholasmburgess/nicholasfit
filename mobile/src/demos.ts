import { Directory, File, Paths } from "expo-file-system";
import type { ImageSourcePropType } from "react-native";
import { getExercise } from "@/lib/exercises";
import { BUNDLED_DEMOS } from "./demoImages";
import { freshSession } from "./store";

const APP_URL = "https://nicholasfit.vercel.app";

/**
 * Exercise demo photos that work in the garage with no signal. The core exercises ship inside the
 * app. Extra exercises the weekly coach adds are downloaded once, when a workout opens with signal,
 * and kept on the phone.
 */
const folder = (id: string) => new Directory(Paths.document, "demos", id);
const frameFile = (id: string, i: number) => new File(folder(id), `${i}.jpg`);

/** The photos to loop for an exercise, or an empty list if it isn't on the phone yet. */
export function demoFrames(id: string): ImageSourcePropType[] {
  const bundled = BUNDLED_DEMOS[id];
  if (bundled) return bundled;
  const urls = getExercise(id)?.images ?? [];
  const files = urls.map((_, i) => frameFile(id, i));
  return files.length > 0 && files.every((f) => f.exists) ? files.map((f) => ({ uri: f.uri })) : [];
}

/** Downloads any missing demos for these exercises. Fails quietly with no signal and tries again next time. */
export async function saveDemosForOffline(ids: string[]): Promise<void> {
  for (const id of new Set(ids)) {
    if (BUNDLED_DEMOS[id]) continue;
    const urls = (getExercise(id)?.images ?? []).filter((u) => u.startsWith("https://"));
    try {
      folder(id).create({ intermediates: true, idempotent: true });
      for (const [i, url] of urls.entries()) {
        const file = frameFile(id, i);
        if (!file.exists) await File.downloadFileAsync(url, file);
      }
    } catch {
      // No signal: the sheet shows the written cues and tries the download again next workout.
    }
  }
}

export type DemoVideo = { url: string; name: string };

/**
 * Asks the website for a short ExerciseDB demo clip. Needs signal; returns null when offline, when
 * ExerciseDB has no match, or when videos aren't set up. Not saved: ExerciseDB's terms forbid it.
 */
export async function fetchDemoVideo(id: string): Promise<DemoVideo | null> {
  try {
    const s = await freshSession();
    const res = await fetch(`${APP_URL}/api/exercise-video?id=${encodeURIComponent(id)}`, {
      headers: s ? { Authorization: `Bearer ${s.accessToken}` } : {},
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { video: DemoVideo | null }).video;
  } catch {
    return null;
  }
}
