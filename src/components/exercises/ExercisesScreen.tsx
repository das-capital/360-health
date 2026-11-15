"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { loadDayLog, loadExercises } from "@/lib/exercises/db";
import { isTemplate, type DayLog, type Exercise } from "@/lib/exercises/types";
import { useLogicalToday } from "@/lib/hooks";
import { isLogicalDate, type LogicalDate } from "@/lib/logical-date";
import { CardioForm, CardioList } from "./Cardio";
import { Hub } from "./Hub";
import { SetLogger } from "./SetLogger";
import { TemplateScreen } from "./TemplateScreen";

/** Where a link inside Exercises points: a template (or "cardio"), an exercise, a day. */
export type Target = { t?: string; e?: number; d?: LogicalDate };
export type LinkTo = (target?: Target) => string;

/** What every Exercises screen needs. */
export type Shared = {
  date: LogicalDate;
  today: LogicalDate;
  exercises: Exercise[];
  log: DayLog;
  link: LinkTo;
  /** Fetch the latest data again after a change. */
  reload: () => Promise<void>;
};

/**
 * Exercises is one page whose screen is chosen by the address:
 *   /exercises                  the day's hub
 *   /exercises?t=push           a template's pick-list
 *   /exercises?t=push&e=12      logging sets for one exercise
 *   /exercises?t=cardio         cardio list
 *   /exercises?t=cardio&e=60    logging one cardio session
 * "d" carries the day when it is not today. Using the address means the
 * phone's back button moves one screen back instead of leaving Exercises.
 */
export function ExercisesScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const today = useLogicalToday();

  const d = params.get("d");
  const date = today && d && isLogicalDate(d) && d <= today ? d : today;
  const t = params.get("t");
  const e = Number(params.get("e")) || null;

  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [loaded, setLoaded] = useState<{ date: LogicalDate; log: DayLog } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!date) return;
    try {
      const [list, log] = await Promise.all([loadExercises(), loadDayLog(date)]);
      setExercises(list);
      setLoaded({ date, log });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [date]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    Promise.all([loadExercises(), loadDayLog(date)])
      .then(([list, log]) => {
        if (cancelled) return;
        setExercises(list);
        setLoaded({ date, log });
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const link: LinkTo = useCallback(
    (target = {}) => {
      const query = new URLSearchParams();
      const day = target.d ?? date;
      if (day && day !== today) query.set("d", day);
      if (target.t) query.set("t", target.t);
      if (target.e) query.set("e", String(target.e));
      const text = query.toString();
      return text ? `/exercises?${text}` : "/exercises";
    },
    [date, today],
  );

  const log = loaded && loaded.date === date ? loaded.log : null;

  if (error) {
    return (
      <>
        <PageHeader title="Exercises" />
        <p className="card border-red-500/40 text-red-300">{error}</p>
      </>
    );
  }
  if (!today || !date || !exercises || !log) {
    return (
      <>
        <PageHeader title="Exercises" />
        <p className="text-neutral-500">Loading…</p>
      </>
    );
  }

  if (exercises.length === 0) {
    return (
      <>
        <PageHeader title="Exercises" />
        <p className="card text-amber-200">
          The exercise lists are not in the database yet. Run{" "}
          <code>supabase/migrations/0003_exercises.sql</code> in the Supabase SQL Editor, then reload.
        </p>
      </>
    );
  }

  const shared: Shared = { date, today, exercises, log, link, reload };
  const exercise = e ? exercises.find((x) => x.id === e) : undefined;

  if (t === "cardio") {
    return exercise?.type === "cardio" ? (
      <CardioForm {...shared} exercise={exercise} onDone={() => router.replace(link({ t: "cardio" }))} />
    ) : (
      <CardioList {...shared} />
    );
  }
  if (isTemplate(t)) {
    return exercise && exercise.type !== "cardio" ? (
      <SetLogger {...shared} template={t} exercise={exercise} />
    ) : (
      <TemplateScreen {...shared} template={t} />
    );
  }
  return <Hub {...shared} onDate={(next) => router.replace(link({ d: next }))} />;
}
