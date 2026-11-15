"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { BAND_TEXT, sleepBand, stepsBand } from "@/lib/daily/rules";
import { templateLabel } from "@/lib/exercises/types";
import { loadFoodDay, loadTargets } from "@/lib/food/db";
import { judgeDay, summariseDay } from "@/lib/food/summary";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, formatLogicalDate, type LogicalDate } from "@/lib/logical-date";
import { getSupabase } from "@/lib/supabase/client";
import { targetFor } from "@/lib/targets";

type Item = {
  key: string;
  label: string;
  href: string;
  /** Short summary once logged; null while still pending. */
  logged: string | null;
  /** Shown in red, e.g. when calories are over target. */
  alert?: string;
  /** Colour of the summary (steps and sleep follow their colour rules). Green if not given. */
  tone?: string;
};

const number = new Intl.NumberFormat("en-IN");

async function loadChecklist(today: LogicalDate): Promise<Item[]> {
  const db = getSupabase();
  const yesterday = addDays(today, -1);

  const [foodDay, targets, steps, sleep, mobility, workouts, cardio, rest] = await Promise.all([
    loadFoodDay(today),
    loadTargets(),
    db.from("steps").select("count").eq("date", today).maybeSingle(),
    db.from("sleep").select("score, skipped").eq("date", today).maybeSingle(),
    db.from("mobility").select("done").eq("date", yesterday).maybeSingle(),
    db.from("workout_sessions").select("template").eq("date", today).order("created_at"),
    db.from("cardio_sessions").select("id").eq("date", today).limit(1),
    db.from("rest_days").select("date").eq("date", today).maybeSingle(),
  ]);

  const failed = [steps, sleep, mobility, workouts, cardio, rest].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  // Food: same numbers and the same live over-target rule as the Food screen.
  const foodSummary = summariseDay(foodDay.meals, foodDay.dayTotals);
  const calories = judgeDay(foodSummary, targets, today, today).calories;
  let food: string | null = null;
  if (foodSummary) {
    food = `${number.format(calories.value ?? 0)} cal`;
    if (calories.target !== null) food += ` of ${number.format(calories.target)}`;
  }
  const foodAlert = calories.over !== null ? `Over target by ${number.format(calories.over)} cal` : undefined;

  let exercise: string | null = null;
  const done = (workouts.data ?? []).map((w) => templateLabel(w.template));
  if ((cardio.data?.length ?? 0) > 0) done.push("Cardio");
  if (done.length > 0) exercise = done.join(", ");
  else if (rest.data) exercise = "Rest day";

  return [
    { key: "food", label: "Food", href: "/food", logged: food, alert: foodAlert },
    {
      key: "steps",
      label: "Steps",
      href: "/steps",
      logged: steps.data ? `${number.format(steps.data.count)} steps` : null,
      tone: steps.data
        ? BAND_TEXT[stepsBand(steps.data.count, targetFor(targets, "steps", today)?.value ?? null)]
        : undefined,
    },
    {
      key: "sleep",
      label: "Last night’s sleep",
      href: "/sleep",
      logged: sleep.data ? (sleep.data.skipped ? "Skipped" : `Score ${sleep.data.score}`) : null,
      tone: sleep.data ? BAND_TEXT[sleepBand(sleep.data.skipped ? null : sleep.data.score)] : undefined,
    },
    {
      key: "mobility",
      label: "Yesterday’s mobility",
      href: "/mobility",
      logged: mobility.data ? (mobility.data.done ? "Done" : "Not done") : null,
      tone: mobility.data && !mobility.data.done ? "text-red-400" : undefined,
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
                    <span className={item.logged ? (item.tone ?? "text-emerald-400") : "text-neutral-500"}>
                      {item.logged ?? "Pending"}
                    </span>
                    {item.alert && <span className="block text-sm text-red-400">{item.alert}</span>}
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
