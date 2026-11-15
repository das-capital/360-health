"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { addExercise } from "@/lib/exercises/db";
import { formatSet } from "@/lib/exercises/format";
import {
  exercisesFor,
  LIST_LABEL,
  TEMPLATES,
  type BaseList,
  type Exercise,
  type ExerciseType,
  type TemplateKey,
} from "@/lib/exercises/types";
import { useDeviceSetting } from "@/lib/hooks";
import { formatLogicalDate } from "@/lib/logical-date";
import type { Shared } from "./ExercisesScreen";

/**
 * A template's pick-list. Tap an exercise to add it to the day's list, then tap
 * it there to log its sets. Exercises that already have sets are always listed.
 */
export function TemplateScreen({
  date,
  today,
  exercises,
  log,
  link,
  reload,
  template,
}: Shared & { template: TemplateKey }) {
  const info = TEMPLATES[template];
  const lists: readonly BaseList[] = info.lists;
  const available = exercisesFor(template, exercises);

  const session = log.sessions.find((s) => s.template === template);
  const sets = session ? log.sets.filter((s) => s.session_id === session.id) : [];
  const logged = new Set(sets.map((s) => s.exercise_id));

  // Picked-but-not-yet-logged exercises are remembered on the device for this day and template.
  const [stored, setStored] = useDeviceSetting(`picks:${date}:${template}`);
  const picked = new Set<number>(parseIds(stored));
  const setPicked = (ids: Set<number>) => setStored(ids.size > 0 ? JSON.stringify([...ids]) : null);

  const [adding, setAdding] = useState(false);

  const chosen = available.filter((e) => logged.has(e.id) || picked.has(e.id));
  const rest = available.filter((e) => !logged.has(e.id) && !picked.has(e.id));

  return (
    <>
      <PageHeader
        title={info.label}
        subtitle={date === today ? "Today" : formatLogicalDate(date)}
        backHref={link()}
      />

      <h2 className="mb-2 text-lg font-semibold">Doing {date === today ? "today" : "that day"}</h2>
      {chosen.length === 0 ? (
        <p className="mb-6 text-neutral-500">Pick the exercises you did from the list below.</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {chosen.map((exercise) => {
            const own = sets.filter((s) => s.exercise_id === exercise.id);
            return (
              <li key={exercise.id} className="flex items-stretch gap-2">
                <Link
                  href={link({ t: template, e: exercise.id })}
                  className="card flex min-h-16 flex-1 items-center gap-3 active:bg-neutral-800"
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      own.length > 0 ? "border-emerald-500 bg-emerald-500 text-neutral-950" : "border-neutral-600"
                    }`}
                  >
                    {own.length > 0 ? "✓" : ""}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg leading-tight">{exercise.name}</span>
                    <span className="text-sm text-neutral-400">
                      {own.length > 0 ? own.map((s) => formatSet(exercise, s)).join(", ") : "Tap to log sets"}
                    </span>
                  </span>
                  <span className="text-neutral-500">›</span>
                </Link>
                {own.length === 0 && (
                  <button
                    type="button"
                    aria-label={`Remove ${exercise.name} from the day's list`}
                    className="btn-secondary h-auto w-12 px-0 text-neutral-400"
                    onClick={() => {
                      const next = new Set(picked);
                      next.delete(exercise.id);
                      setPicked(next);
                    }}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-semibold">Pick exercises</h2>
      {lists.map((list) => {
        const inList = rest.filter((e) => e.base_list === list);
        if (inList.length === 0) return null;
        return (
          <section key={list} className="mb-4">
            {lists.length > 1 && <h3 className="mb-1 text-sm text-neutral-400">{LIST_LABEL[list]}</h3>}
            <ul className="flex flex-col gap-1.5">
              {inList.map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    className="flex min-h-13 w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-left active:bg-neutral-800"
                    onClick={() => setPicked(new Set(picked).add(exercise.id))}
                  >
                    <span aria-hidden className="text-xl text-emerald-400">
                      +
                    </span>
                    {exercise.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {adding ? (
        <AddExerciseForm
          lists={lists}
          exercises={exercises}
          onCancel={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await reload();
          }}
        />
      ) : (
        <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setAdding(true)}>
          Add exercise
        </button>
      )}
    </>
  );
}

function parseIds(stored: string | null): number[] {
  try {
    const ids = JSON.parse(stored ?? "[]");
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

/** A new exercise is saved to its base list for good, so it shows in every template using that list. */
function AddExerciseForm({
  lists,
  exercises,
  onAdded,
  onCancel,
}: {
  lists: readonly BaseList[];
  exercises: Exercise[];
  onAdded: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [list, setList] = useState<BaseList>(lists[0]);
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) return setError("Enter a name.");

    const type: ExerciseType = list === "plyo" ? "plyo" : timed ? "timed" : "strength";
    const last = Math.max(0, ...exercises.filter((e) => e.base_list === list).map((e) => e.sort_order));

    setBusy(true);
    setError(null);
    try {
      await addExercise({ name: cleaned, type, base_list: list, sort_order: last + 1 });
      await onAdded();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card mt-2 flex flex-col gap-3">
      <h3 className="text-lg font-semibold">Add exercise</h3>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">Name</span>
        <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="field" />
      </label>

      {lists.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-400">Belongs to</span>
          <select value={list} onChange={(e) => setList(e.target.value as BaseList)} className="field">
            {lists.map((key) => (
              <option key={key} value={key}>
                {LIST_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      )}

      {list !== "plyo" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-400">Logged as</span>
          <select value={timed ? "timed" : "strength"} onChange={(e) => setTimed(e.target.value === "timed")} className="field">
            <option value="strength">Reps and weight</option>
            <option value="timed">Timed hold (seconds)</option>
          </select>
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? "Saving…" : "Save exercise"}
        </button>
        <button type="button" disabled={busy} className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
