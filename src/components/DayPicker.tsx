"use client";

import { addDays, formatLogicalDate, type LogicalDate } from "@/lib/logical-date";

/** Step through days or jump to one. Any past day can be opened; the future cannot. */
export function DayPicker({
  date,
  today,
  onChange,
}: {
  date: LogicalDate;
  today: LogicalDate;
  onChange: (date: LogicalDate) => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        className="btn-secondary w-12 px-0 text-xl"
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </button>
      <label className="relative flex h-12 flex-1 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 font-medium">
        {date === today ? "Today" : formatLogicalDate(date)}
        <input
          type="date"
          aria-label="Choose day"
          value={date}
          max={today}
          onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full opacity-0"
        />
      </label>
      <button
        type="button"
        aria-label="Next day"
        className="btn-secondary w-12 px-0 text-xl"
        disabled={date >= today}
        onClick={() => onChange(addDays(date, 1))}
      >
        ›
      </button>
    </div>
  );
}
