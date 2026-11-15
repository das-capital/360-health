"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { addSet, deleteSet, loadLastSession, updateSet } from "@/lib/exercises/db";
import { formatSet, parseSet, setFields } from "@/lib/exercises/format";
import {
  TEMPLATES,
  type Exercise,
  type SetRow,
  type SetValues,
  type TemplateKey,
} from "@/lib/exercises/types";
import { formatLogicalDate, type LogicalDate } from "@/lib/logical-date";
import type { Shared } from "./ExercisesScreen";
import { RenameExercise } from "./RenameExercise";

type Typed = Partial<Record<keyof SetValues, string>>;

const toTyped = (exercise: Exercise, values: SetValues | undefined): Typed =>
  Object.fromEntries(setFields(exercise).map((f) => [f.key, values?.[f.key]?.toString() ?? ""]));

/** Log the sets of one exercise. Each set is saved the moment it is added. */
export function SetLogger({
  date,
  today,
  log,
  link,
  reload,
  template,
  exercise,
}: Shared & { template: TemplateKey; exercise: Exercise }) {
  const session = log.sessions.find((s) => s.template === template);
  const sets = session
    ? log.sets.filter((s) => s.session_id === session.id && s.exercise_id === exercise.id)
    : [];

  const [last, setLast] = useState<{ key: string; data: { date: LogicalDate; sets: SetRow[] } | null } | null>(null);
  const [editing, setEditing] = useState<SetRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Previous session of this exercise, shown for reference while logging.
  const lastKey = `${exercise.id}:${date}`;
  useEffect(() => {
    let cancelled = false;
    loadLastSession(exercise.id, date)
      .then((data) => !cancelled && setLast({ key: `${exercise.id}:${date}`, data }))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [exercise.id, date]);
  const previous = last && last.key === lastKey ? last : null;

  // Start the inputs from the set being edited, else the last set today, else last session's first set.
  const startFrom: SetValues | undefined = editing ?? sets.at(-1) ?? previous?.data?.sets[0];

  async function save(values: SetValues) {
    if (editing) {
      await updateSet(editing.id, values);
      setEditing(null);
    } else {
      const nextNo = Math.max(0, ...sets.map((s) => s.set_no)) + 1;
      await addSet(date, template, exercise.id, nextNo, values);
    }
    await reload();
  }

  async function remove(set: SetRow) {
    setError(null);
    try {
      await deleteSet(set);
      if (editing?.id === set.id) setEditing(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={exercise.name}
        subtitle={`${TEMPLATES[template].label} · ${date === today ? "Today" : formatLogicalDate(date)}`}
        backHref={link({ t: template })}
      />
      <RenameExercise exercise={exercise} onRenamed={reload} />

      <section className="card mb-4">
        <h2 className="text-sm text-neutral-400">Last session</h2>
        {!previous && <p className="text-neutral-500">Loading…</p>}
        {previous && !previous.data && <p className="text-neutral-500">No earlier session.</p>}
        {previous?.data && (
          <>
            <p className="text-sm text-neutral-500">{formatLogicalDate(previous.data.date)}</p>
            <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {previous.data.sets.map((set, index) => (
                <li key={set.id}>
                  <span className="text-neutral-500">{index + 1}.</span> {formatSet(exercise, set)}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <h2 className="mb-2 text-lg font-semibold">{date === today ? "Today" : "That day"}</h2>
      {sets.length === 0 ? (
        <p className="mb-4 text-neutral-500">No sets yet.</p>
      ) : (
        <ol className="mb-4 flex flex-col gap-1.5">
          {sets.map((set, index) => (
            <li
              key={set.id}
              className={`flex min-h-13 items-center gap-2 rounded-xl border px-3 ${
                editing?.id === set.id ? "border-emerald-500 bg-neutral-900" : "border-neutral-800 bg-neutral-900"
              }`}
            >
              <span className="w-14 text-neutral-400">Set {index + 1}</span>
              <span className="flex-1 text-lg">{formatSet(exercise, set)}</span>
              <button
                type="button"
                className="h-10 px-2 text-sm text-neutral-300"
                onClick={() => setEditing(editing?.id === set.id ? null : set)}
              >
                {editing?.id === set.id ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                className="h-10 px-2 text-sm text-red-300"
                onClick={() => {
                  if (window.confirm(`Delete set ${index + 1}?`)) void remove(set);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <SetForm
        // A new key resets the inputs: after each save, when editing starts or stops,
        // and once the last session has loaded.
        key={`${sets.length}:${editing?.id ?? "new"}:${previous ? "ready" : "wait"}`}
        exercise={exercise}
        initial={toTyped(exercise, startFrom)}
        label={editing ? `Save set ${sets.findIndex((s) => s.id === editing.id) + 1}` : `Add set ${sets.length + 1}`}
        onSave={save}
      />
    </>
  );
}

function SetForm({
  exercise,
  initial,
  label,
  onSave,
}: {
  exercise: Exercise;
  initial: Typed;
  label: string;
  onSave: (values: SetValues) => Promise<void>;
}) {
  const fields = setFields(exercise);
  const [typed, setTyped] = useState<Typed>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseSet(exercise, typed);
    if (!parsed.ok) return setError(parsed.error);

    setBusy(true);
    setError(null);
    try {
      await onSave(parsed.values);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <div className={`grid gap-2 ${fields.length === 1 ? "grid-cols-1" : fields.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">
              {field.label}
              {field.optional ? " (optional)" : ""}
            </span>
            <input
              type="number"
              inputMode={field.whole ? "numeric" : "decimal"}
              min="0"
              step="any"
              value={typed[field.key] ?? ""}
              onChange={(e) => setTyped({ ...typed, [field.key]: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="field h-14 px-2 text-center text-xl"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary h-14 text-lg">
        {busy ? "Saving…" : label}
      </button>
    </form>
  );
}
