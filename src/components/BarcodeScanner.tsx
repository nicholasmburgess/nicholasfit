"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Card";

/** Full-screen camera view that reads a product barcode. */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current ?? undefined,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls.stop();
              navigator.vibrate?.(50);
              onCodeRef.current(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch {
        if (!cancelled) setError("Camera not available. Allow camera access in Settings, or type the number below.");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const code = manual.replace(/\D/g, "");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="flex items-center justify-between py-2">
        <span className="font-semibold">Scan a barcode</span>
        <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-white/80">
          Cancel
        </button>
      </div>
      <div className="relative mt-2 aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-white/70" />
      </div>
      {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : <p className="mt-3 text-center text-sm text-white/70">Hold the barcode inside the box</p>}
      <div className="mt-auto flex gap-2 pt-4">
        <input
          inputMode="numeric"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type the barcode number"
          className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/50"
        />
        <Button onClick={() => onCode(code)} disabled={code.length < 8}>
          Look up
        </Button>
      </div>
    </div>
  );
}
