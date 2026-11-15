"use client";

import { useState } from "react";
import { Chart, CHART_COLORS, type ChartPoint } from "@/components/history/Chart";
import { dash, LoadState, RangeTabs, rangeStart, Section, slot, Stat, StatGrid, type RangeKey } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { stepsBand } from "@/lib/daily/rules";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import { loadStepsHistory } from "@/lib/history/db";
import { dayRange, windowAverage, windowRate, WINDOWS } from "@/lib/history/stats";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, daysBetween, formatLogicalDate } from "@/lib/logical-date";
import { targetFor } from "@/lib/targets";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export default function StepsHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadStepsHistory);
  const [range, setRange] = useState<RangeKey>("month");

  const body = () => {
    if (!today || !history.value) return null;
    const { rows, targets } = history.value;
    const yesterday = addDays(today, -1);
    const targetOn = (date: string) => targetFor(targets, "steps", date)?.value ?? null;

    const start = rangeStart(range, today, rows[0]?.date ?? null);
    const byDate = new Map(rows.map((r) => [r.date, r.count]));
    const points: ChartPoint[] = dayRange(start, today).map((date) => {
      const count = byDate.get(date) ?? null;
      const target = targetOn(date);
      return {
        x: slot(start, date),
        value: count,
        label: formatLogicalDate(date),
        target,
        color: count === null ? undefined : CHART_COLORS[stepsBand(count, target)],
      };
    });

    // Averages and days on target use closed days only: today is still running.
    const closed = new Map(rows.filter((r) => r.date <= yesterday).map((r) => [r.date, r.count]));
    const met = new Map<string, boolean>();
    for (const [date, count] of closed) {
      const target = targetOn(date);
      if (target !== null) met.set(date, count >= target);
    }
    const inRange = windowRate(met, yesterday, range === "all" ? null : daysBetween(start, yesterday) + 1);

    return (
      <>
        <RangeTabs value={range} onChange={setRange} />
        <div className="card mb-4">
          <Chart key={range} points={points} slots={daysBetween(start, today) + 1} kind="bar" format={(v) => number.format(v)} />
          <p className="mt-2 text-xs text-neutral-500">
            Green: target met · Orange: up to 25% below · Red: further below
          </p>
        </div>

        <Section title="Days on target">
          <div className="card">
            <p className="text-3xl font-semibold tabular-nums">
              {inRange.hits}
              <span className="text-base font-normal text-neutral-400">
                {" "}
                of {inRange.days} logged {inRange.days === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="text-sm text-neutral-500">
              {range === "all" ? "All time" : range === "week" ? "Last 7 days" : "Last 31 days"}, not counting today.
            </p>
          </div>
        </Section>

        <Section title="Average steps">
          <StatGrid>
            {WINDOWS.map((days) => {
              const avg = windowAverage(closed, yesterday, days);
              return <Stat key={days} label={`Last ${days} days`} value={avg === null ? dash : number.format(avg)} />;
            })}
          </StatGrid>
          <p className="text-sm text-neutral-500">Days with no count entered are left out, not counted as zero.</p>
        </Section>
      </>
    );
  };

  return (
    <>
      <PageHeader title="Steps history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
