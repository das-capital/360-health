"use client";

import { useState } from "react";
import { Chart, CHART_COLORS, type ChartPoint } from "@/components/history/Chart";
import { dash, LoadState, RangeTabs, rangeStart, Section, slot, Stat, Tabs, type RangeKey } from "@/components/history/parts";
import { PageHeader } from "@/components/PageHeader";
import { useDayEntry } from "@/lib/daily/useDayEntry";
import type { MetricResult, Verdict } from "@/lib/food/summary";
import { loadFoodHistory } from "@/lib/history/db";
import { FOOD_METRICS, foodDays, metByDate, type FoodDay, type FoodMetric } from "@/lib/history/food-stats";
import { dayRange, streaks, windowRate } from "@/lib/history/stats";
import { useLogicalToday } from "@/lib/hooks";
import { addDays, daysBetween, formatLogicalDate } from "@/lib/logical-date";
import { targetFor } from "@/lib/targets";

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const METRIC: Record<FoodMetric, { label: string; unit: string; rule: string }> = {
  calories: { label: "Calories", unit: "cal", rule: "at or under target" },
  protein: { label: "Protein", unit: "g", rule: "at or above target" },
  fibre: { label: "Fibre", unit: "g", rule: "at or above target" },
};

const VERDICT_COLOR: Record<Verdict, string> = {
  met: CHART_COLORS.green,
  not_met: CHART_COLORS.red,
  pending: CHART_COLORS.none,
  unknown: CHART_COLORS.none,
  no_target: CHART_COLORS.plain,
};

/** A small mark plus words, so met / not met never relies on colour alone. */
function Marker({ result, unit }: { result: MetricResult; unit: string }) {
  const value = result.value === null ? "?" : number.format(result.value);
  const mark =
    result.verdict === "met"
      ? { sign: "✓", style: "text-emerald-400", word: "met" }
      : result.verdict === "not_met"
        ? { sign: "✗", style: "text-red-400", word: "not met" }
        : result.verdict === "unknown"
          ? { sign: "?", style: "text-neutral-500", word: "unknown" }
          : { sign: "", style: "text-neutral-500", word: result.verdict === "pending" ? "day still open" : "no target" };
  return (
    <span className="tabular-nums" aria-label={`${value} ${unit}, ${mark.word}`}>
      {value}
      <span className="text-neutral-500"> {unit}</span>
      {mark.sign && <span className={`ml-1 font-bold ${mark.style}`}>{mark.sign}</span>}
    </span>
  );
}

function DayRow({ day }: { day: FoodDay }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-neutral-800 bg-neutral-900">
      <button type="button" className="w-full p-3 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center justify-between">
          <span className="font-medium">{formatLogicalDate(day.date)}</span>
          <span className="text-neutral-500">{open ? "▾" : "▸"}</span>
        </span>
        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {FOOD_METRICS.map((metric) => (
            <Marker key={metric} result={day.result[metric]} unit={METRIC[metric].unit} />
          ))}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-500">
          Targets that day:{" "}
          {FOOD_METRICS.map((metric) => {
            const target = day.result[metric].target;
            return `${target === null ? "none" : number.format(target)} ${METRIC[metric].unit}`;
          }).join(" · ")}
        </span>
      </button>
      {open && (
        <table className="w-full border-t border-neutral-800 text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="p-2 pl-3 font-normal">Meal</th>
              <th className="p-2 text-right font-normal">Cal</th>
              <th className="p-2 text-right font-normal">Protein</th>
              <th className="p-2 pr-3 text-right font-normal">Fibre</th>
            </tr>
          </thead>
          <tbody>
            {day.summary.slots.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-neutral-500">
                  Only day totals were saved for this day.
                </td>
              </tr>
            )}
            {day.summary.slots.map((s) => (
              <tr key={s.slot} className="border-t border-neutral-800/60 tabular-nums">
                <td className="p-2 pl-3">{s.slot}</td>
                <td className="p-2 text-right">{s.calories === null ? "?" : number.format(s.calories)}</td>
                <td className="p-2 text-right">{s.protein === null ? "?" : `${number.format(s.protein)} g`}</td>
                <td className="p-2 pr-3 text-right">{s.fibre === null ? "?" : `${number.format(s.fibre)} g`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}

export default function FoodHistoryPage() {
  const today = useLogicalToday();
  const history = useDayEntry(today, loadFoodHistory);
  const [range, setRange] = useState<RangeKey>("month");
  const [metric, setMetric] = useState<FoodMetric>("calories");

  const body = () => {
    if (!today || !history.value) return null;
    const { meals, totals, targets } = history.value;
    const days = foodDays(meals, totals, targets, today);
    const yesterday = addDays(today, -1);
    const info = METRIC[metric];

    const start = rangeStart(range, today, days[0]?.date ?? null);
    const byDate = new Map(days.map((d) => [d.date, d]));
    const points: ChartPoint[] = dayRange(start, today).map((date) => {
      const day = byDate.get(date);
      return {
        x: slot(start, date),
        value: day?.result[metric].value ?? null,
        label: formatLogicalDate(date),
        target: targetFor(targets, metric, date)?.value ?? null,
        color: day ? VERDICT_COLOR[day.result[metric].verdict] : undefined,
      };
    });

    const met = metByDate(days, metric, today);
    const rate = windowRate(met, yesterday, range === "all" ? null : daysBetween(start, yesterday) + 1);
    const streak = streaks(met, yesterday);
    const listed = days.filter((d) => d.date >= start).reverse();

    return (
      <>
        <Tabs
          options={FOOD_METRICS.map((key) => ({ key, label: METRIC[key].label }))}
          value={metric}
          onChange={setMetric}
        />
        <RangeTabs value={range} onChange={setRange} />

        <div className="card mb-4">
          <Chart
            key={`${metric}-${range}`}
            points={points}
            slots={daysBetween(start, today) + 1}
            kind="bar"
            format={(v) => `${number.format(v)} ${info.unit}`}
          />
          <p className="mt-2 text-xs text-neutral-500">
            Green: met ({info.rule}) · Red: not met · Grey: day still open
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2">
          <Stat
            label="Hit rate"
            value={rate.percent === null ? dash : `${rate.percent}%`}
            note={rate.days > 0 ? `${rate.hits} of ${rate.days} days` : undefined}
          />
          <Stat label="Current streak" value={streak.current} note={streak.current === 1 ? "day" : "days"} />
          <Stat label="Best streak" value={streak.best} note={streak.best === 1 ? "day" : "days"} />
        </div>
        <p className="-mt-4 mb-6 text-sm text-neutral-500">
          Today and days with a missing number are left out of the hit rate. A missed or unknown day ends a streak.
        </p>

        <Section title="Days">
          {listed.length === 0 ? (
            <p className="text-neutral-500">No food logged in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {listed.map((day) => (
                <DayRow key={day.date} day={day} />
              ))}
            </ul>
          )}
        </Section>
      </>
    );
  };

  return (
    <>
      <PageHeader title="Food history" backHref="/history" />
      <LoadState loading={!history.value} error={history.error} />
      {body()}
    </>
  );
}
