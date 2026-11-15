"use client";

import { useState } from "react";
import { DayPicker } from "@/components/DayPicker";
import { PageHeader } from "@/components/PageHeader";
import { deleteSleep, loadSleep, saveSleep } from "@/lib/daily/db";
import { BAND_TEXT, parseScore, sleepBand } from "@/lib/daily/rules";
import { useAction, useDayEntry } from "@/lib/daily/useDayEntry";
import { useLogicalToday } from "@/lib/hooks";
import type { LogicalDate } from "@/lib/logical-date";

export default function SleepPage() {
  const today = useLogicalToday();
  const [picked, setPicked] = useState<LogicalDate | null>(null);
  // A night belongs to the day you woke up, so "today" means last night.
  const date = picked ?? today;

  const night = useDayEntry(date, loadSleep);
  const [draft, setDraft] = useState<{ date: LogicalDate; text: string } | null>(null);
  const action = useAction(() => {
    setDraft(null);
    night.reload();
  });

  const entry = night.value;
  const text = draft && draft.date === date ? draft.text : "";

  const save = () => {
    const score = parseScore(text);
    if (score === null) return action.setError("The score is a whole number from 1 to 100.");
    void action.run(() => saveSleep(date!, score));
  };

  return (
    <>
      <PageHeader
        title="Sleep"
        subtitle={date && date === today ? "Last night" : "The night before the day shown"}
        backHref="/"
      />

      {!today || !date ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <>
          <DayPicker date={date} today={today} onChange={setPicked} />

          {night.error && <p className="card mb-4 border-red-500/40 text-red-300">Could not load: {night.error}</p>}
          {entry === undefined && !night.error && <p className="text-neutral-500">Loading…</p>}

          {entry !== undefined && (
            <>
              <div className="card mb-4 text-center">
                {entry === null ? (
                  <p className="py-2 text-neutral-500">Not logged yet.</p>
                ) : entry.skipped ? (
                  <p className="py-2 text-2xl text-neutral-400">Skipped</p>
                ) : (
                  <>
                    <p className={`text-6xl font-semibold tabular-nums ${BAND_TEXT[sleepBand(entry.score)]}`}>
                      {entry.score}
                    </p>
                    <p className="mt-1 text-neutral-400">sleep score</p>
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
                  <span className="text-neutral-400">Sleep score from Samsung Health (1 to 100)</span>
                  <input
                    className="field h-16 text-center text-2xl"
                    inputMode="numeric"
                    placeholder={entry?.score ? String(entry.score) : "e.g. 82"}
                    value={text}
                    onChange={(e) => setDraft({ date, text: e.target.value })}
                  />
                </label>
                {action.error && <p className="text-red-400">{action.error}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="btn-secondary h-14 text-lg"
                    disabled={action.busy || entry?.skipped === true}
                    onClick={() => void action.run(() => saveSleep(date, null))}
                  >
                    Skip
                  </button>
                  <button type="submit" className="btn-primary h-14 text-lg" disabled={action.busy || text.trim() === ""}>
                    {entry === null ? "Save" : "Update"}
                  </button>
                </div>
              </form>

              {entry !== null && (
                <button
                  type="button"
                  className="mt-6 h-10 text-neutral-500 underline"
                  disabled={action.busy}
                  onClick={() => void action.run(() => deleteSleep(date))}
                >
                  Remove this night’s entry
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
