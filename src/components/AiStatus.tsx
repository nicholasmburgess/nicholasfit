"use client";

import { useEffect, useState } from "react";

/** Shows whether the Claude key in Vercel is set and accepted. */
export function AiStatus() {
  const [s, setS] = useState<{ ok: boolean; reason?: string } | null>(null);
  useEffect(() => {
    fetch("/api/meal-estimate")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ ok: false, reason: "Couldn't check" }));
  }, []);
  if (!s) return null;
  return (
    <p className={`text-center text-xs ${s.ok ? "text-muted" : "text-danger"}`}>
      {s.ok ? "✓ AI meal estimates connected" : `AI meal estimates not working: ${s.reason ?? "unknown problem"}`}
    </p>
  );
}
