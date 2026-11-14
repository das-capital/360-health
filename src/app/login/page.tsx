"use client";

import { useState, type FormEvent } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // Full reload so the server sees the new session.
    window.location.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold">360 Health</h1>
        <p className="mt-1 text-neutral-400">Log in to continue.</p>
      </div>

      {!supabaseConfigured ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          Supabase is not set up yet. Add the project URL and publishable key to{" "}
          <code>.env.local</code>, then restart the app.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-400">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-400">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
      )}
    </main>
  );
}
