"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DayPicker } from "@/components/DayPicker";
import { PageHeader } from "@/components/PageHeader";
import { deleteSteps, loadSteps, saveSteps } from "@/lib/daily/db";
import { BAND_TEXT, parseSteps, stepsBand } from "@/lib/daily/rules";
import { useAction, useDayEntry } from "@/lib/daily/useDayEntry";
import { loadTargets } from "@/lib/food/db";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, type LogicalDate } from "@/lib/logical-date";
import { targetFor } from "@/lib/targets";

const number = new Intl.NumberFormat("en-IN");

async function loadDay(date: LogicalDate) {
  const [count, targets] = await Promise.all([loadSteps(date), loadTargets()]);
  return { count, target: targetFor(targets, "steps", date)?.value ?? null };
}

function StepsScreen() {
  const today = useLogicalToday();
  // The morning reminder opens this screen on yesterday.
  const startOnYesterday = useSearchParams().get("d") === "yesterday";
  const [picked, setPicked] = useState<LogicalDate | null>(null);
  const date = picked ?? (today ? (startOnYesterday ? addDays(today, -1) : today) : null);

  const day = useDayEntry(date, loadDay);
  const [draft, setDraft] = useState<{ date: LogicalDate; text: string } | null>(null);
  const action = useAction(() => {
    setDraft(null);
    day.reload();
  });

  if (!today || !date) return <p className="text-neutral-500">Loading…</p>;

  const saved = day.value?.count ?? null;
  const target = day.value?.target ?? null;
  const text = draft && draft.date === date ? draft.text : "";

  const save = () => {
    const count = parseSteps(text);
    if (count === null) return action.setError("Type the step count as a whole number.");
    void action.run(() => saveSteps(date, count));
  };

  return (
    <>
      <DayPicker date={date} today={today} onChange={setPicked} />

      {day.error && <p className="card mb-4 border-red-500/40 text-red-300">Could not load: {day.error}</p>}
      {!day.value && !day.error && <p className="text-neutral-500">Loading…</p>}

      {day.value && (
        <>
          <div className="card mb-4 text-center">
            {saved === null ? (
              <p className="py-2 text-neutral-500">No steps logged for this day.</p>
            ) : (
              <>
                <p className={`text-5xl font-semibold tabular-nums ${BAND_TEXT[stepsBand(saved, target)]}`}>
                  {number.format(saved)}
                </p>
                <p className="mt-1 text-neutral-400">
                  {target === null
                    ? "steps · no target set for this day"
                    : saved >= target
                      ? `steps · target of ${number.format(target)} met`
                      : `steps · ${number.format(target - saved)} short of ${number.format(target)}`}
                </p>
              </>
            )}
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-neutral-400">{date === today ? "Steps so far today" : "Steps for the day"}</span>
              <input
                className="field h-16 text-center text-2xl"
                inputMode="numeric"
                placeholder={saved === null ? "e.g. 8450" : number.format(saved)}
                value={text}
                onChange={(e) => setDraft({ date, text: e.target.value })}
              />
            </label>
            {action.error && <p className="text-red-400">{action.error}</p>}
            <button type="submit" className="btn-primary h-14 text-lg" disabled={action.busy || text.trim() === ""}>
              {saved === null ? "Save" : "Update"}
            </button>
          </form>

          {saved !== null && (
            <button
              type="button"
              className="mt-6 h-10 text-neutral-500 underline"
              disabled={action.busy}
              onClick={() => void action.run(() => deleteSteps(date))}
            >
              Remove this day’s entry
            </button>
          )}
        </>
      )}
    </>
  );
}

export default function StepsPage() {
  return (
    <>
      <PageHeader title="Steps" backHref="/" />
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <StepsScreen />
      </Suspense>
    </>
  );
}
