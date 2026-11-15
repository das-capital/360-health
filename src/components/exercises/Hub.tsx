"use client";

import Link from "next/link";
import { useState } from "react";
import { DayPicker } from "@/components/DayPicker";
import { PageHeader } from "@/components/PageHeader";
import { setRestDay } from "@/lib/exercises/db";
import { formatCardio, formatSet } from "@/lib/exercises/format";
import { TEMPLATES, templateLabel, type TemplateKey } from "@/lib/exercises/types";
import type { LogicalDate } from "@/lib/logical-date";
import type { Shared } from "./ExercisesScreen";

/** The day's overview: what is logged, and the ways to log more. */
export function Hub({
  date,
  today,
  exercises,
  log,
  link,
  reload,
  onDate,
}: Shared & { onDate: (date: LogicalDate) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const worked = log.sets.length > 0 || log.cardio.length > 0;
  const dayWord = date === today ? "today" : "that day";

  async function rest(value: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setRestDay(date, value);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Exercises" />
      <DayPicker date={date} today={today} onChange={onDate} />

      {error && <p className="card mb-4 border-red-500/40 text-red-300">{error}</p>}

      {log.rest && (
        <section className="card mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-medium text-emerald-400">Rest day</p>
            <p className="text-sm text-neutral-400">Logged as “did nothing”.</p>
          </div>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => rest(false)}>
            Undo
          </button>
        </section>
      )}

      {worked && (
        <section className="mb-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Logged {dayWord}</h2>
          {log.sessions.map((session) => {
            const sets = log.sets.filter((s) => s.session_id === session.id);
            const ids = [...new Set(sets.map((s) => s.exercise_id))];
            if (ids.length === 0) return null;
            return (
              <Link key={session.id} href={link({ t: session.template })} className="card block active:bg-neutral-800">
                <p className="font-medium text-emerald-400">{templateLabel(session.template)}</p>
                <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-300">
                  {ids.map((id) => {
                    const exercise = byId.get(id);
                    if (!exercise) return null;
                    const own = sets.filter((s) => s.exercise_id === id);
                    return (
                      <li key={id}>
                        <span className="text-neutral-100">{exercise.name}:</span>{" "}
                        {own.map((s) => formatSet(exercise, s)).join(", ")}
                      </li>
                    );
                  })}
                </ul>
              </Link>
            );
          })}
          {log.cardio.length > 0 && (
            <Link href={link({ t: "cardio" })} className="card block active:bg-neutral-800">
              <p className="font-medium text-emerald-400">Cardio</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-neutral-300">
                {log.cardio.map((row) => {
                  const exercise = byId.get(row.exercise_id);
                  if (!exercise?.cardio_kind) return null;
                  return (
                    <li key={row.id}>
                      <span className="text-neutral-100">{exercise.name}:</span>{" "}
                      {formatCardio(exercise.cardio_kind, row.fields)}
                    </li>
                  );
                })}
              </ul>
            </Link>
          )}
        </section>
      )}

      <h2 className="mb-2 text-lg font-semibold">Log a workout</h2>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
          <Link key={key} href={link({ t: key })} className="btn-secondary h-16 text-lg">
            {TEMPLATES[key].label}
          </Link>
        ))}
        <Link href={link({ t: "cardio" })} className="btn-secondary h-16 text-lg">
          Cardio
        </Link>
      </div>

      {!worked && !log.rest && (
        <button type="button" className="btn-secondary mt-6 w-full" disabled={busy} onClick={() => rest(true)}>
          Did nothing {dayWord}
        </button>
      )}
    </>
  );
}
