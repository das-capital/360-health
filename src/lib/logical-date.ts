/**
 * The one shared "logical date" helper (CLAUDE.md section 2).
 *
 * - Timezone is Asia/Kolkata (IST), which is a fixed UTC+5:30 with no daylight saving.
 * - The day rolls over at 4:00 am IST, not midnight. Anything between 00:00 and
 *   03:59 IST belongs to the previous day.
 *
 * Logical dates are plain "YYYY-MM-DD" strings. Use these functions everywhere a
 * "day" is needed (logging, reminders, history, met / not met). Never call
 * `new Date()` and format it yourself.
 */

export const TIMEZONE = "Asia/Kolkata";
export const ROLLOVER_HOUR = 4;

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Shifting a moment by (IST offset - rollover hour) makes the UTC calendar date
 * of the shifted moment equal to the logical date in IST.
 */
const SHIFT_MS = (IST_OFFSET_MINUTES - ROLLOVER_HOUR * 60) * MS_PER_MINUTE;

/** A logical date, formatted "YYYY-MM-DD". */
export type LogicalDate = string;

/** The logical date that the given moment (default: now) belongs to. */
export function logicalDate(at: Date = new Date()): LogicalDate {
  return new Date(at.getTime() + SHIFT_MS).toISOString().slice(0, 10);
}

/** Move a logical date forward or back by whole days. */
export function addDays(date: LogicalDate, days: number): LogicalDate {
  return new Date(parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The logical date before the one the given moment belongs to. */
export function logicalYesterday(at: Date = new Date()): LogicalDate {
  return addDays(logicalDate(at), -1);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LogicalDate, to: LogicalDate): number {
  return Math.round((parse(to) - parse(from)) / MS_PER_DAY);
}

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isLogicalDate(value: string): value is LogicalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Human-friendly label, e.g. "Sat, 14 Nov 2026". */
export function formatLogicalDate(date: LogicalDate): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parse(date)));
}

function parse(date: LogicalDate): number {
  if (!isLogicalDate(date)) throw new Error(`Not a logical date: "${date}"`);
  return Date.parse(`${date}T00:00:00Z`);
}
