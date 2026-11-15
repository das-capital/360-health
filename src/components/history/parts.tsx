"use client";

import type { ReactNode } from "react";
import { daysBetween, type LogicalDate } from "@/lib/logical-date";
import { windowStart } from "@/lib/history/stats";

export type RangeKey = "week" | "month" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

/** Week / Month / All switch shown above the charts. */
export function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return <Tabs options={RANGES} value={value} onChange={onChange} />;
}

export function Tabs<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="mb-4 flex rounded-xl border border-neutral-800 bg-neutral-900 p-1" role="tablist">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          className={`h-10 flex-1 rounded-lg text-sm font-medium ${
            value === option.key ? "bg-neutral-700 text-neutral-50" : "text-neutral-400"
          }`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The first day a range shows. "All" starts at the first logged day (or a
 * week back if there is very little), so the chart is never one lonely bar.
 */
export function rangeStart(range: RangeKey, end: LogicalDate, firstLogged: LogicalDate | null): LogicalDate {
  if (range === "week") return windowStart(end, 7);
  if (range === "month") return windowStart(end, 31);
  const week = windowStart(end, 7);
  return firstLogged && firstLogged < week ? firstLogged : week;
}

/** Position of a day inside a range that starts on `start`. */
export const slot = (start: LogicalDate, date: LogicalDate) => daysBetween(start, date);

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-3 gap-2">{children}</div>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Loading and error states shared by the History screens. */
export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) return <p className="card mb-4 border-red-500/40 text-red-300">Could not load: {error}</p>;
  if (loading) return <p className="text-neutral-500">Loading…</p>;
  return null;
}

export const dash = "–";
