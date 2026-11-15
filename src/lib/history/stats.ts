import { addDays, daysBetween, type LogicalDate } from "../logical-date";

/**
 * Shared calculations for the History screens (CLAUDE.md section 6).
 * Pure logic. Missing days are never treated as zero.
 */

export const WINDOWS = [7, 31, 90] as const;

/** Every day from `from` to `to`, both included. Empty if `from` is after `to`. */
export function dayRange(from: LogicalDate, to: LogicalDate): LogicalDate[] {
  const days: LogicalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The first day of a window of `days` days ending on `end`. */
export function windowStart(end: LogicalDate, days: number): LogicalDate {
  return addDays(end, -(days - 1));
}

/** Average of the values, to one decimal. Null when there are none. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * Average over the last `days` days ending on `end`, using only the days that
 * have a value.
 */
export function windowAverage(byDate: Map<LogicalDate, number>, end: LogicalDate, days: number): number | null {
  const start = windowStart(end, days);
  const values: number[] = [];
  for (const [date, value] of byDate) if (date >= start && date <= end) values.push(value);
  return average(values);
}

export type Rate = { hits: number; days: number; percent: number | null };

/** How many of the answered days in the window were a hit (true). */
export function windowRate(byDate: Map<LogicalDate, boolean>, end: LogicalDate, days: number | null): Rate {
  const start = days === null ? null : windowStart(end, days);
  let hits = 0;
  let total = 0;
  for (const [date, hit] of byDate) {
    if (date > end || (start !== null && date < start)) continue;
    total++;
    if (hit) hits++;
  }
  return { hits, days: total, percent: total === 0 ? null : Math.round((hits / total) * 100) };
}

/**
 * Current and best streak of hits. A miss ends a streak, and so does a day
 * with no answer. The newest `grace` days may still be unanswered without
 * ending the current streak (e.g. yesterday's mobility not asked yet).
 */
export function streaks(
  byDate: Map<LogicalDate, boolean>,
  end: LogicalDate,
  grace = 0,
): { current: number; best: number } {
  if (byDate.size === 0) return { current: 0, best: 0 };
  const first = [...byDate.keys()].sort()[0];
  let last = end;
  for (let i = 0; i < grace && last > first && !byDate.has(last); i++) last = addDays(last, -1);

  let best = 0;
  let run = 0;
  for (const day of dayRange(first, last)) {
    run = byDate.get(day) === true ? run + 1 : 0;
    if (run > best) best = run;
  }
  return { current: run, best };
}

/**
 * Change from the most recent entry at least `days` days before the latest
 * entry, to the latest entry. Null if there is no entry that far back.
 */
export function changeOver(entries: { date: LogicalDate; value: number }[], days: number): number | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const cutoff = addDays(latest.date, -days);
  const earlier = sorted.filter((e) => e.date <= cutoff).pop();
  if (!earlier) return null;
  return Math.round((latest.value - earlier.value) * 10) / 10;
}

/** Estimated one-rep max (Epley): weight × (1 + reps ÷ 30). One rep is the weight itself. */
export function oneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** The Monday that starts the week a day falls in. */
export function weekStart(date: LogicalDate): LogicalDate {
  // 2024-01-01 was a Monday.
  const offset = ((daysBetween("2024-01-01", date) % 7) + 7) % 7;
  return addDays(date, -offset);
}

/** Signed number for a change, e.g. "+1.2" or "−0.5". */
export function signed(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}
