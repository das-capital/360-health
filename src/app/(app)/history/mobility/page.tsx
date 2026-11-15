"use client";

import { useState } from "react";
import { dash, LoadState, Section, Stat, StatGrid } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import { loadMobilityHistory } from "@/lib/history/db";
import { dayRange, streaks, weekStart, windowRate, WINDOWS } from "@/lib/history/stats";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, daysBetween, type LogicalDate } from "@/lib/logical-date";

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

/** First day of the month before or after the given "YYYY-MM". */
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

export default function MobilityHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadMobilityHistory);
  const [picked, setPicked] = useState<string | null>(null);

  const body = () => {
    if (!today || !history.value) return null;
    const done = new Map<LogicalDate, boolean>(history.value.map((r) => [r.date, r.done]));
    const month = picked ?? today.slice(0, 7);

    const first = `${month}-01`;
    const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
    const blanks = daysBetween(weekStart(first), first);
    // Today or yesterday may not be answered yet; that does not end the streak.
    const streak = streaks(done, today, 2);

    return (
      <>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            className="btn-secondary w-12 px-0 text-xl"
            onClick={() => setPicked(shiftMonth(month, -1))}
          >
            ‹
          </button>
          <p className="flex-1 text-center font-medium">{monthLabel(month)}</p>
          <button
            type="button"
            aria-label="Next month"
            className="btn-secondary w-12 px-0 text-xl"
            disabled={month >= today.slice(0, 7)}
            onClick={() => setPicked(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>

        <div className="card mb-2">
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="text-xs text-neutral-500">
                {d}
              </span>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {dayRange(first, last).map((date) => {
              const answer = done.get(date);
              const style =
                answer === true
                  ? "bg-emerald-500 text-neutral-950 font-semibold"
                  : answer === false
                    ? "bg-red-500/80 text-neutral-950 font-semibold"
                    : date > today
                      ? "text-neutral-700"
                      : "border border-neutral-700 text-neutral-400";
              return (
                <span
                  key={date}
                  aria-label={`${date}: ${answer === true ? "done" : answer === false ? "not done" : "no answer"}`}
                  className={`flex aspect-square items-center justify-center rounded-lg text-sm ${style}`}
                >
                  {Number(date.slice(8))}
                </span>
              );
            })}
          </div>
        </div>
        <p className="mb-6 text-xs text-neutral-500">Green: done · Red: not done · Outline: no answer</p>

        <Section title="Percentage done">
          <StatGrid>
            {WINDOWS.map((days) => {
              const rate = windowRate(done, today, days);
              return (
                <Stat
                  key={days}
                  label={`Last ${days} days`}
                  value={rate.percent === null ? dash : `${rate.percent}%`}
                  note={rate.days > 0 ? `${rate.hits} of ${rate.days} answered` : undefined}
                />
              );
            })}
          </StatGrid>
        </Section>

        <Section title="Streaks">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Current" value={`${streak.current} ${streak.current === 1 ? "day" : "days"}`} />
            <Stat label="Best" value={`${streak.best} ${streak.best === 1 ? "day" : "days"}`} />
          </div>
          <p className="mt-2 text-sm text-neutral-500">A “No” or a day with no answer ends a streak.</p>
        </Section>
      </>
    );
  };

  return (
    <>
      <PageHeader title="Mobility history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
