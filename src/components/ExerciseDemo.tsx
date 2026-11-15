"use client";

import { useEffect, useState } from "react";

/** Loops the start and end photos of an exercise so the movement reads like a short animation. */
export function ExerciseDemo({ images, name, className = "" }: { images: string[]; name: string; className?: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % images.length), 1100);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-white ${className}`} style={{ aspectRatio: "4 / 3" }}>
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${name}, ${i === 0 ? "start" : "end"} position`}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
          style={{ opacity: frame === i ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
