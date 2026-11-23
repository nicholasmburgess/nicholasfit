"use client";

import { useEffect, useState } from "react";

/**
 * Streams a short ExerciseDB clip for a stretch, looping and silent. Never saved: ExerciseDB's terms
 * forbid caching. Calls onFail when there is no signal, no matching clip, or videos aren't set up.
 */
export function StretchVideo({ id, onFail }: { id: string; onFail: (why: string) => void }) {
  const [clip, setClip] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    let live = true;
    setClip(null);
    fetch(`/api/exercise-video?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!live) return;
        if (body.video) setClip(body.video);
        else onFail(r.status === 503 ? "Videos aren't set up yet." : r.ok ? "No video for this one yet." : "Couldn't load the video.");
      })
      .catch(() => live && onFail("No signal for video."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-white" style={{ aspectRatio: "4 / 3" }}>
      {clip ? (
        <>
          <video key={clip.url} src={clip.url} className="absolute inset-0 h-full w-full object-contain" autoPlay muted loop playsInline onError={() => onFail("Couldn't play the video.")} />
          <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{clip.name} · ExerciseDB</span>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-neutral-500">Loading video…</div>
      )}
    </div>
  );
}
