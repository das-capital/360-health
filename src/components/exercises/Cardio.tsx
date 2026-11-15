"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { addCardio, deleteCardio } from "@/lib/exercises/db";
import { CARDIO_FIELDS, formatCardio, parseCardio } from "@/lib/exercises/format";
import type { Exercise } from "@/lib/exercises/types";
import { formatLogicalDate } from "@/lib/logical-date";
import type { Shared } from "./ExercisesScreen";
import { RenameExercise } from "./RenameExercise";

/** The cardio section: the three cardio types, with the day's sessions under each. */
export function CardioList({ date, today, exercises, log, link, reload }: Shared) {
  const [error, setError] = useState<string | null>(null);
  const cardio = exercises.filter((e) => e.type === "cardio" && e.cardio_kind);

  return (
    <>
      <PageHeader title="Cardio" subtitle={date === today ? "Today" : formatLogicalDate(date)} backHref={link()} />
      {error && <p className="card mb-4 border-red-500/40 text-red-300">{error}</p>}

      <ul className="flex flex-col gap-3">
        {cardio.map((exercise) => {
          const rows = log.cardio.filter((row) => row.exercise_id === exercise.id);
          return (
            <li key={exercise.id} className="card">
              <Link
                href={link({ t: "cardio", e: exercise.id })}
                className="flex min-h-12 items-center justify-between text-lg"
              >
                {exercise.name}
                <span className="text-emerald-400">+ Log</span>
              </Link>
              {rows.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5 border-t border-neutral-800 pt-2">
                  {rows.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-neutral-300">{formatCardio(exercise.cardio_kind!, row.fields)}</span>
                      <button
                        type="button"
                        className="h-10 px-2 text-red-300"
                        onClick={async () => {
                          if (!window.confirm(`Delete this ${exercise.name} session?`)) return;
                          try {
                            await deleteCardio(row.id);
                            await reload();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Cardio is logged once per session, not per set. */
export function CardioForm({
  date,
  today,
  link,
  reload,
  exercise,
  onDone,
}: Shared & { exercise: Exercise; onDone: () => void }) {
  const kind = exercise.cardio_kind!;
  const fields = CARDIO_FIELDS[kind];
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCardio(kind, typed);
    if (!parsed.ok) return setError(parsed.error);

    setBusy(true);
    setError(null);
    try {
      await addCardio(date, exercise.id, parsed.fields);
      await reload();
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={exercise.name}
        subtitle={`Cardio · ${date === today ? "Today" : formatLogicalDate(date)}`}
        backHref={link({ t: "cardio" })}
      />
      <RenameExercise exercise={exercise} onRenamed={reload} />

      <form onSubmit={save} className="card flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">
                {field.label}
                {field.unit && field.unit !== "rounds" ? ` (${field.unit})` : ""}
                {field.optional ? ", optional" : ""}
              </span>
              <input
                type="number"
                inputMode={field.whole ? "numeric" : "decimal"}
                min="0"
                step="any"
                value={typed[field.key] ?? ""}
                onChange={(e) => setTyped({ ...typed, [field.key]: e.target.value })}
                className="field h-14 px-2 text-center text-xl"
              />
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary h-14 text-lg">
          {busy ? "Saving…" : "Save session"}
        </button>
      </form>
    </>
  );
}
