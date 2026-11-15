"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Card";
import { hasSupabase } from "@/lib/supabase/config";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!hasSupabase) {
    return <p className="pt-10 text-center text-muted">Demo mode has no login. Open the Today tab to start.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const auth = supabase().auth;
    const { data, error } =
      mode === "signin" ? await auth.signInWithPassword({ email, password }) : await auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMessage(error.message);
    if (mode === "signup" && !data.session) return setMessage("Check your email to confirm your account, then sign in here.");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-[80dvh] flex-col justify-center">
      <h1 className="text-3xl font-bold">Nicholasfit</h1>
      <p className="mb-6 text-muted">{mode === "signin" ? "Sign in to continue" : "Create your account"}</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="h-12 w-full rounded-xl border border-line bg-card-2 px-4 outline-none focus:border-accent"
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="h-12 w-full rounded-xl border border-line bg-card-2 px-4 outline-none focus:border-accent"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button className="w-full" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
      {message && <p className="mt-3 text-sm text-warn">{message}</p>}
      <button className="mt-6 text-sm text-muted" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "First time? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
