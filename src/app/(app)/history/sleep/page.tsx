"use client";

import { useState } from "react";
import { Chart, CHART_COLORS, type ChartPoint } from "@/components/history/Chart";
import { dash, LoadState, RangeTabs, rangeStart, Section, slot, Stat, StatGrid, type RangeKey } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { sleepBand } from "@/lib/daily/rules";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import { loadSleepHistory } from "@/lib/history/db";
import { dayRange, windowAverage, WINDOWS } from "@/lib/history/stats";
import { useLogicalToday } from "@/lib/hooks";
import { daysBetween, formatLogicalDate } from "@/lib/logical-date";

export default function SleepHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadSleepHistory);
  const [range, setRange] = useState<RangeKey>("month");

  const body = () => {
    if (!today || !history.value) return null;
    const rows = history.value;
    const scores = new Map<string, number>();
    for (const row of rows) if (!row.skipped && row.score !== null) scores.set(row.date, row.score);

    const start = rangeStart(range, today, rows[0]?.date ?? null);
    // A skipped or unlogged night is a gap: the line breaks there.
    const points: ChartPoint[] = dayRange(start, today).map((date) => {
      const score = scores.get(date) ?? null;
      return {
        x: slot(start, date),
        value: score,
        label: formatLogicalDate(date),
        color: CHART_COLORS[sleepBand(score)],
      };
    });
    const skipped = rows.filter((r) => r.skipped && r.date >= start).length;

    return (
      <>
        <RangeTabs value={range} onChange={setRange} />
        <div className="card mb-4">
          <Chart key={range} points={points} slots={daysBetween(start, today) + 1} kind="line" format={(v) => String(v)} />
          <p className="mt-2 text-xs text-neutral-500">
            Blue: above 85 · Green: 80 to 85 · Orange: 70 to 79 · Red: below 70. Gaps are nights skipped or not logged
            {skipped > 0 ? ` (${skipped} skipped in this period)` : ""}.
          </p>
        </div>

        <Section title="Average score">
          <StatGrid>
            {WINDOWS.map((days) => {
              const avg = windowAverage(scores, today, days);
              return <Stat key={days} label={`Last ${days} days`} value={avg === null ? dash : avg} />;
            })}
          </StatGrid>
          <p className="text-sm text-neutral-500">Skipped nights are left out of the averages.</p>
        </Section>
      </>
    );
  };

  return (
    <>
      <PageHeader title="Sleep history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
