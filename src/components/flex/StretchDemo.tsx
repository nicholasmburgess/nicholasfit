"use client";

import { useState } from "react";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { StretchVideo } from "./StretchVideo";

/** Looping photos by default (instant, work offline); "Watch video" streams a clip instead. */
export function StretchDemo({ id, images, name }: { id: string; images: string[]; name: string }) {
  const [video, setVideo] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {video ? (
        <StretchVideo
          id={id}
          onFail={(why) => {
            setVideo(false);
            setNote(why);
          }}
        />
      ) : (
        <ExerciseDemo images={images} name={name} />
      )}
      <button
        className="w-full rounded-xl border border-line py-2.5 text-sm font-medium text-accent"
        onClick={() => {
          setNote(null);
          setVideo(!video);
        }}
      >
        {video ? "Show photos" : "▶ Watch video"}
      </button>
      {note && <p className="text-center text-xs text-muted">{note} Showing photos.</p>}
    </div>
  );
}
