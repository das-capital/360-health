import { judgeDay, summariseDay, type DayResult, type DaySummary } from "../food/summary";
import type { DayTotalsRow, MealRow } from "../food/types";
import type { LogicalDate } from "../logical-date";
import type { Target } from "../targets";

export type FoodMetric = "calories" | "protein" | "fibre";
export const FOOD_METRICS: FoodMetric[] = ["calories", "protein", "fibre"];

export type FoodDay = { date: LogicalDate; summary: DaySummary; result: DayResult };

/**
 * Every day with food logged, judged against the targets that applied on
 * that day, using the same rules as the Food screen. Oldest first.
 */
export function foodDays(
  meals: (MealRow & { date: LogicalDate })[],
  totals: (DayTotalsRow & { date: LogicalDate })[],
  targets: Target[],
  today: LogicalDate,
): FoodDay[] {
  const dates = new Set<LogicalDate>([...meals.map((m) => m.date), ...totals.map((t) => t.date)]);
  const days: FoodDay[] = [];
  for (const date of [...dates].sort()) {
    const summary = summariseDay(
      meals.filter((m) => m.date === date),
      totals.find((t) => t.date === date) ?? null,
    );
    if (!summary) continue;
    days.push({ date, summary, result: judgeDay(summary, targets, date, today) });
  }
  return days;
}

/**
 * Met / not met per closed day for one metric. Days that are still open,
 * unknown or had no target are left out, so they never count in a hit rate.
 */
export function metByDate(days: FoodDay[], metric: FoodMetric, today: LogicalDate): Map<LogicalDate, boolean> {
  const map = new Map<LogicalDate, boolean>();
  for (const day of days) {
    if (day.date >= today) continue;
    const verdict = day.result[metric].verdict;
    if (verdict === "met") map.set(day.date, true);
    else if (verdict === "not_met") map.set(day.date, false);
  }
  return map;
}
