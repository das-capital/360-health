"use client";

import { useState, type FormEvent } from "react";
import { renameExercise } from "@/lib/exercises/db";
import type { Exercise } from "@/lib/exercises/types";

/** Rename an exercise. The new name shows on past logs too. */
export function RenameExercise({ exercise, onRenamed }: { exercise: Exercise; onRenamed: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="mb-4 h-10 text-sm text-neutral-400 underline underline-offset-4"
        onClick={() => {
          setName(exercise.name);
          setError(null);
          setOpen(true);
        }}
      >
        Rename this exercise
      </button>
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) return setError("Enter a name.");
    if (cleaned === exercise.name) return setOpen(false);

    setBusy(true);
    setError(null);
    try {
      await renameExercise(exercise.id, cleaned);
      await onRenamed();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card mb-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">New name (applies to past logs too)</span>
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? "Saving…" : "Save name"}
        </button>
        <button type="button" disabled={busy} className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
