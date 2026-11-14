"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, formatLogicalDate, type LogicalDate } from "@/lib/logical-date";
import { getSupabase } from "@/lib/supabase/client";

type Item = {
  key: string;
  label: string;
  href: string;
  /** Short summary once logged; null while still pending. */
  logged: string | null;
};

const number = new Intl.NumberFormat("en-IN");

async function loadChecklist(today: LogicalDate): Promise<Item[]> {
  const db = getSupabase();
  const yesterday = addDays(today, -1);

  const [dayTotal, meals, steps, sleep, mobility, workouts, cardio, rest] = await Promise.all([
    db.from("food_day_totals").select("calories").eq("date", today).maybeSingle(),
    db.from("food_meals").select("calories").eq("date", today),
    db.from("steps").select("count").eq("date", today).maybeSingle(),
    db.from("sleep").select("score, skipped").eq("date", today).maybeSingle(),
    db.from("mobility").select("done").eq("date", yesterday).maybeSingle(),
    db.from("workout_sessions").select("id").eq("date", today).limit(1),
    db.from("cardio_sessions").select("id").eq("date", today).limit(1),
    db.from("rest_days").select("date").eq("date", today).maybeSingle(),
  ]);

  const failed = [dayTotal, meals, steps, sleep, mobility, workouts, cardio, rest].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  // Food: the All Meals total wins if present, otherwise the sum of meals.
  let food: string | null = null;
  if (dayTotal.data?.calories != null) {
    food = `${number.format(dayTotal.data.calories)} cal`;
  } else if (meals.data && meals.data.length > 0) {
    const sum = meals.data.reduce((total, meal) => total + (meal.calories ?? 0), 0);
    food = `${number.format(sum)} cal so far`;
  }

  let exercise: string | null = null;
  if ((workouts.data?.length ?? 0) > 0 || (cardio.data?.length ?? 0) > 0) exercise = "Workout logged";
  else if (rest.data) exercise = "Rest day";

  return [
    { key: "food", label: "Food", href: "/food", logged: food },
    {
      key: "steps",
      label: "Steps",
      href: "/steps",
      logged: steps.data ? `${number.format(steps.data.count)} steps` : null,
    },
    {
      key: "sleep",
      label: "Last night’s sleep",
      href: "/sleep",
      logged: sleep.data ? (sleep.data.skipped ? "Skipped" : `Score ${sleep.data.score}`) : null,
    },
    {
      key: "mobility",
      label: "Yesterday’s mobility",
      href: "/mobility",
      logged: mobility.data ? (mobility.data.done ? "Done" : "Not done") : null,
    },
    { key: "exercises", label: "Exercises", href: "/exercises", logged: exercise },
  ];
}

export default function TodayPage() {
  const today = useLogicalToday();
  const [loaded, setLoaded] = useState<{ date: LogicalDate; items: Item[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    loadChecklist(today)
      .then((items) => {
        if (cancelled) return;
        setLoaded({ date: today, items });
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [today]);

  // Ignore a checklist that belongs to a previous day (e.g. after the 4 am rollover).
  const items = loaded && loaded.date === today ? loaded.items : null;
  const pending = items?.filter((item) => !item.logged).length;

  return (
    <>
      <PageHeader title="Today" subtitle={today ? formatLogicalDate(today) : " "} />

      {error && (
        <p className="card mb-4 border-red-500/40 text-red-300">Could not load today: {error}</p>
      )}

      {!items && !error && <p className="text-neutral-500">Loading…</p>}

      {items && (
        <>
          <p className="mb-3 text-neutral-400">
            {pending === 0 ? "Everything is logged." : `${pending} of ${items.length} still to log.`}
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="card flex min-h-18 items-center gap-3 active:bg-neutral-800"
                >
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                      item.logged
                        ? "border-emerald-500 bg-emerald-500 text-neutral-950"
                        : "border-neutral-600"
                    }`}
                  >
                    {item.logged ? "✓" : ""}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg">{item.label}</span>
                    <span className={item.logged ? "text-emerald-400" : "text-neutral-500"}>
                      {item.logged ?? "Pending"}
                    </span>
                  </span>
                  <span className="text-neutral-500">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
