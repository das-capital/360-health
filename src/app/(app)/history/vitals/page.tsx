"use client";

import { Chart, type ChartPoint } from "@/components/history/Chart";
import { dash, LoadState } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { VITAL_FIELDS } from "@/lib/daily/rules";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import { loadVitalsHistory } from "@/lib/history/db";
import { changeOver, signed } from "@/lib/history/stats";
import { useLogicalToday } from "@/lib/hooks";
import { daysBetween, formatLogicalDate } from "@/lib/logical-date";

export default function VitalsHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadVitalsHistory);

  const body = () => {
    if (!today || !history.value) return null;
    const rows = history.value;
    if (rows.length === 0) return <p className="card text-neutral-400">No body measurements logged yet.</p>;

    return (
      <div className="flex flex-col gap-4">
        {VITAL_FIELDS.map((field) => {
          const entries = rows
            .filter((r) => r[field.key] !== null)
            .map((r) => ({ date: r.date, value: Number(r[field.key]) }));
          if (entries.length === 0) {
            return (
              <div key={field.key} className="card">
                <h2 className="text-lg font-semibold">{field.label}</h2>
                <p className="text-neutral-500">No entries yet.</p>
              </div>
            );
          }
          const first = entries[0].date;
          const latest = entries[entries.length - 1];
          // Spaced by real time, so a gap of weeks looks like a gap of weeks.
          const points: ChartPoint[] = entries.map((e) => ({
            x: daysBetween(first, e.date),
            value: e.value,
            label: formatLogicalDate(e.date),
          }));
          const change = (days: number) => {
            const delta = changeOver(entries, days);
            return delta === null ? dash : `${signed(delta)} ${field.unit}`;
          };

          return (
            <div key={field.key} className="card">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{field.label}</h2>
                <p className="text-sm text-neutral-400">
                  <span className="text-xl font-semibold text-neutral-100 tabular-nums">{latest.value}</span> {field.unit}
                  {" · "}
                  {formatLogicalDate(latest.date).replace(/,? \d{4}$/, "")}
                </p>
              </div>
              <Chart
                points={points}
                slots={daysBetween(first, latest.date) + 1}
                kind="line"
                format={(v) => `${v} ${field.unit}`}
              />
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p className="rounded-lg bg-neutral-800/60 p-2">
                  <span className="block text-xs text-neutral-400">Change over 30 days</span>
                  <span className="font-semibold tabular-nums">{change(30)}</span>
                </p>
                <p className="rounded-lg bg-neutral-800/60 p-2">
                  <span className="block text-xs text-neutral-400">Change over 90 days</span>
                  <span className="font-semibold tabular-nums">{change(90)}</span>
                </p>
              </div>
            </div>
          );
        })}
        <p className="text-sm text-neutral-500">
          A change compares your latest entry with the entry at least that many days before it. A dash means there is no
          entry that far back yet.
        </p>
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Body Vitals history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
