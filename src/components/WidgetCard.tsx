"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/Card";
import { supabase } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/config";
import { LOG_NAME, RINGS_NAME, logScript, ringsScript } from "@/lib/widget-scripts";

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }
  return (
    <Button variant="secondary" className="w-full" onClick={copy}>
      {done ? "Copied ✓" : label}
    </Button>
  );
}

/** Makes a personal widget key and hands over the two Scriptable scripts with it filled in. */
export function WidgetCard() {
  const [made, setMade] = useState<string | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase()
      .from("widget_tokens")
      .select("created_at")
      .maybeSingle()
      .then(({ data, error }) => setMade(error ? null : (data?.created_at ?? null)));
  }, []);

  async function makeKey() {
    setBusy(true);
    setError(null);
    try {
      const t = newToken();
      const { data } = await supabase().auth.getUser();
      const { error } = await supabase()
        .from("widget_tokens")
        .upsert({ user_id: data.user?.id, token_hash: await sha256Hex(t), created_at: new Date().toISOString() });
      if (error) throw error;
      setToken(t);
      setMade(new Date().toISOString());
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      setError(/widget_tokens/.test(msg) ? "Run 0005_widget.sql in Supabase first, then try again." : "Couldn't make a key. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasSupabase || made === undefined) return null;
  const base = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <Card className="space-y-3">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <h2 className="font-semibold">Home-screen widget</h2>
        <span className="text-sm text-muted">{open ? "Hide" : made ? "Set up ✓" : "Set up"}</span>
      </button>
      {open && (
        <>
          <p className="text-sm text-muted">
            A small widget with today&apos;s calorie and protein rings. Tap it to photograph a meal and log it without opening the app.
          </p>
          {!token ? (
            <>
              {made && (
                <p className="text-xs text-muted">
                  You made a widget key on {new Date(made).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}. A new key gives you fresh scripts to copy and stops the old ones working.
                </p>
              )}
              <Button className="w-full" onClick={makeKey} disabled={busy}>
                {busy ? "Making key…" : made ? "Make a new key" : "Make my widget key"}
              </Button>
            </>
          ) : (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              <li>
                Install{" "}
                <a className="text-accent underline" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noreferrer">
                  Scriptable
                </a>{" "}
                (free) from the App Store.
              </li>
              <li className="space-y-2">
                <span>
                  Copy the widget script. In Scriptable tap <b>+</b>, paste, tap the title at the top and rename it <b>{RINGS_NAME}</b>, then tap Done.
                </span>
                <CopyButton text={ringsScript(base, token)} label="Copy widget script" />
              </li>
              <li className="space-y-2">
                <span>
                  Copy the meal script. Make another new script the same way and name it exactly <b>{LOG_NAME}</b>.
                </span>
                <CopyButton text={logScript(base, token)} label="Copy meal script" />
              </li>
              <li>
                On your home screen, press and hold, tap <b>Edit</b> then <b>Add Widget</b>. Pick <b>Scriptable</b>, the small size, and add it.
              </li>
              <li>
                Press and hold the new widget, tap <b>Edit Widget</b>, and set Script to <b>{RINGS_NAME}</b>.
              </li>
              <li className="text-muted">The scripts contain your private key. Don&apos;t share them. If you lose them, make a new key here.</li>
            </ol>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </>
      )}
    </Card>
  );
}
