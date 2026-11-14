import type { LogicalDate } from "../logical-date";
import { targetFor, type Target } from "../targets";
import { compareSlots, type DayTotalsRow, type MealRow } from "./types";

export type SlotSummary = {
  slot: string;
  calories: number | null;
  protein: number | null;
  fibre: number | null;
  entries: MealRow[];
};

export type DaySummary = {
  calories: number | null;
  protein: number | null;
  fibre: number | null;
  /** Where the day's numbers come from. */
  source: "all_meals" | "meal_sum";
  /** True when a saved All Meals total exists but a meal was saved after it. */
  staleTotal: boolean;
  slots: SlotSummary[];
};

/**
 * Add up values. Null if there is nothing to add or if ANY value is unknown:
 * a missing number is never treated as zero.
 */
export function sumKnown(values: (number | null)[]): number | null {
  if (values.length === 0 || values.some((v) => v === null)) return null;
  return round1(values.reduce<number>((total, v) => total + (v as number), 0));
}

/**
 * The day's numbers. Uses the All Meals total if there is one, otherwise the
 * sum of meals. If any meal was saved after the All Meals total, that total is
 * out of date, so the sum of meals is used instead.
 * Returns null when nothing is logged for the day.
 */
export function summariseDay(meals: MealRow[], totals: DayTotalsRow | null): DaySummary | null {
  if (meals.length === 0 && !totals) return null;

  const slotNames = [...new Set(meals.map((m) => m.slot))].sort(compareSlots);
  const slots: SlotSummary[] = slotNames.map((slot) => {
    const entries = meals.filter((m) => m.slot === slot);
    return {
      slot,
      calories: sumKnown(entries.map((e) => e.calories)),
      protein: sumKnown(entries.map((e) => e.protein_g)),
      fibre: sumKnown(entries.map((e) => e.fibre_g)),
      entries,
    };
  });

  const mealSum = {
    calories: sumKnown(slots.map((s) => s.calories)),
    protein: sumKnown(slots.map((s) => s.protein)),
    fibre: sumKnown(slots.map((s) => s.fibre)),
  };

  const staleTotal =
    totals !== null && meals.some((m) => Date.parse(m.created_at) > Date.parse(totals.updated_at));

  if (totals && !staleTotal) {
    return {
      calories: totals.calories ?? mealSum.calories,
      protein: totals.protein_g ?? mealSum.protein,
      fibre: totals.fibre_g ?? mealSum.fibre,
      source: "all_meals",
      staleTotal: false,
      slots,
    };
  }
  return { ...mealSum, source: "meal_sum", staleTotal, slots };
}

/**
 * met      = target reached (final)
 * not_met  = target missed (for calories this shows the moment it is crossed)
 * pending  = the day is still open, nothing to judge yet
 * unknown  = the day is closed but the number is missing; excluded from hit rates
 * no_target = no target applied on that day
 */
export type Verdict = "met" | "not_met" | "pending" | "unknown" | "no_target";

export type MetricResult = {
  value: number | null;
  target: number | null;
  verdict: Verdict;
};

export type DayResult = {
  calories: MetricResult & { over: number | null };
  protein: MetricResult;
  fibre: MetricResult;
};

/**
 * Judge each food metric on its own, against the target that applied on that day.
 * Calories: at or under target; "over" is flagged live. Protein and fibre: at
 * or above target, judged only once the day has closed (after the 4 am rollover).
 */
export function judgeDay(
  summary: DaySummary | null,
  targets: Target[],
  date: LogicalDate,
  today: LogicalDate,
): DayResult {
  const closed = date < today;

  const calTarget = targetFor(targets, "calories", date)?.value ?? null;
  const calories = summary?.calories ?? null;
  let calVerdict: Verdict;
  if (calTarget === null) calVerdict = "no_target";
  else if (calories !== null && calories > calTarget) calVerdict = "not_met";
  else if (!closed) calVerdict = "pending";
  else calVerdict = calories === null ? "unknown" : "met";

  const atLeast = (metric: "protein" | "fibre"): MetricResult => {
    const target = targetFor(targets, metric, date)?.value ?? null;
    const value = summary?.[metric] ?? null;
    let verdict: Verdict;
    if (target === null) verdict = "no_target";
    else if (!closed) verdict = "pending";
    else if (value === null) verdict = "unknown";
    else verdict = value >= target ? "met" : "not_met";
    return { value, target, verdict };
  };

  return {
    calories: {
      value: calories,
      target: calTarget,
      verdict: calVerdict,
      over: calTarget !== null && calories !== null && calories > calTarget ? round1(calories - calTarget) : null,
    },
    protein: atLeast("protein"),
    fibre: atLeast("fibre"),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
