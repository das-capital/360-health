"use client";

import { useState } from "react";
import { DayPicker } from "@/components/DayPicker";
import { PageHeader } from "@/components/PageHeader";
import { deleteMobility, loadMobility, saveMobility } from "@/lib/daily/db";
import { useAction, useDayEntry } from "@/lib/daily/useDayEntry";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, type LogicalDate } from "@/lib/logical-date";

export default function MobilityPage() {
  const today = useLogicalToday();
  const [picked, setPicked] = useState<LogicalDate | null>(null);
  // The question is always about yesterday unless another day is chosen.
  const date = picked ?? (today ? addDays(today, -1) : null);

  const day = useDayEntry(date, loadMobility);
  const [changing, setChanging] = useState<LogicalDate | null>(null);
  const action = useAction(() => {
    setChanging(null);
    day.reload();
  });

  const done = day.value;
  const asking = done === null || changing === date;

  return (
    <>
      <PageHeader title="Mobility" backHref="/" />

      {!today || !date ? (
        <p className="text-neutral-500">Loading…</p>
      ) : (
        <>
          <DayPicker date={date} today={today} onChange={setPicked} />

          {day.error && <p className="card mb-4 border-red-500/40 text-red-300">Could not load: {day.error}</p>}
          {done === undefined && !day.error && <p className="text-neutral-500">Loading…</p>}

          {done !== undefined && (
            <>
              <p className="mb-4 text-center text-xl">
                {date === addDays(today, -1)
                  ? "Did you do your mobility session yesterday?"
                  : date === today
                    ? "Did you do your mobility session today?"
                    : "Did you do your mobility session that day?"}
              </p>

              {asking ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="flex h-28 items-center justify-center rounded-2xl bg-emerald-500 text-3xl font-semibold text-neutral-950 active:bg-emerald-400 disabled:opacity-50"
                    disabled={action.busy}
                    onClick={() => void action.run(() => saveMobility(date, true))}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="flex h-28 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 text-3xl font-semibold active:bg-neutral-800 disabled:opacity-50"
                    disabled={action.busy}
                    onClick={() => void action.run(() => saveMobility(date, false))}
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="card text-center">
                  <p className={`py-2 text-4xl font-semibold ${done ? "text-emerald-400" : "text-red-400"}`}>
                    {done ? "Yes, done" : "No, not done"}
                  </p>
                  <div className="mt-3 flex justify-center gap-6">
                    <button type="button" className="h-10 text-neutral-400 underline" onClick={() => setChanging(date)}>
                      Change
                    </button>
                    <button
                      type="button"
                      className="h-10 text-neutral-500 underline"
                      disabled={action.busy}
                      onClick={() => void action.run(() => deleteMobility(date))}
                    >
                      Remove answer
                    </button>
                  </div>
                </div>
              )}

              {action.error && <p className="mt-3 text-red-400">{action.error}</p>}
            </>
          )}
        </>
      )}
    </>
  );
}
