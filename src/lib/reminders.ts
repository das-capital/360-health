import { addDays, logicalDate, type LogicalDate } from "./logical-date";

/**
 * Reminder rules (CLAUDE.md section 5). Pure logic: given the time and what is
 * logged, decide which check-in is due and what it should say. Sending and
 * database access live elsewhere.
 */

export const REMINDER_KINDS = ["morning", "afternoon", "evening"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Reminder times as IST wall-clock "HH:MM". */
export type ReminderTimes = Record<ReminderKind, string>;

export const DEFAULT_TIMES: ReminderTimes = { morning: "08:00", afternoon: "13:30", evening: "20:00" };

/** A reminder may still go out this long after its set time (e.g. if a job run was missed). */
export const LATE_WINDOW_MINUTES = 60;

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** Minutes since midnight on the IST clock. */
export function istMinutes(now: Date): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The moment an IST wall-clock time occurs on a logical day (for times from 4:00 am on). */
export function istMoment(date: LogicalDate, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+05:30`);
}

/** When each check-in was last handled today (sent or skipped), if at all. */
export type HandledAt = Partial<Record<ReminderKind, Date>>;

/**
 * True if a check-in still counts as done for the day. It does not if its
 * time was moved later after it went out: a reminder handled at 3:30 pm and
 * then rescheduled to 5:00 pm goes out again at 5:00 pm.
 */
export function isHandled(kind: ReminderKind, today: LogicalDate, times: ReminderTimes, handledAt: HandledAt): boolean {
  const at = handledAt[kind];
  return at !== undefined && at.getTime() >= istMoment(today, times[kind]).getTime();
}

/**
 * Which reminders should go out now: their time has arrived (within the late
 * window) and they have not been handled for this logical day at their
 * current time.
 */
export function dueReminders(now: Date, times: ReminderTimes, handledAt: HandledAt): ReminderKind[] {
  const minute = istMinutes(now);
  const today = logicalDate(now);
  return REMINDER_KINDS.filter((kind) => {
    if (isHandled(kind, today, times, handledAt)) return false;
    const start = toMinutes(times[kind]);
    return minute >= start && minute < start + LATE_WINDOW_MINUTES;
  });
}

/** What is logged, as far as reminders care. */
export type LoggedState = {
  /** Steps entered for the previous logical day. */
  stepsYesterday: boolean;
  /** Last night's sleep answered (a score or Skip). */
  sleep: boolean;
  /** Yesterday's mobility answered (yes or no). */
  mobilityYesterday: boolean;
  /** When food was last saved for today (any meal or day total), or null. */
  foodSavedAt: Date | null;
  /** When today's steps were last saved, or null. */
  stepsSavedAt: Date | null;
  /** A workout or "Did nothing today" is logged for today. */
  exercise: boolean;
};

export type Reminder = {
  title: string;
  body: string;
  url: string;
  tag: string;
  /**
   * Present when yesterday's mobility is still unanswered: the notification
   * then carries Yes / No buttons. `rest` is what remains to log once mobility
   * is answered (null if nothing), so the notification can be shown again
   * without the mobility part.
   */
  mobility?: { rest: string | null };
};

/**
 * The notification for a check-in, or null when everything it would ask
 * about is already logged (the reminder is then skipped).
 *
 * Afternoon: an item is skipped if it has been logged at all today.
 * Evening: food and steps are skipped only if saved since the afternoon
 * check-in time, because a lunchtime entry does not cover dinner.
 */
export function buildReminder(
  kind: ReminderKind,
  state: LoggedState,
  /** When today's afternoon check-in was (or is) scheduled. */
  afternoonAt: Date,
): Reminder | null {
  if (kind === "morning") {
    const others = [!state.stepsYesterday && "yesterday’s steps", !state.sleep && "last night’s sleep score"].filter(
      Boolean,
    ) as string[];
    const items = state.mobilityYesterday ? others : [...others, "yesterday’s mobility"];
    if (items.length === 0) return null;
    return {
      title: "Morning check-in",
      body: `To log: ${list(items)}.`,
      // Tapping opens the first thing still missing.
      url: !state.stepsYesterday ? "/steps?d=yesterday" : !state.sleep ? "/sleep" : "/mobility",
      tag: "morning",
      ...(state.mobilityYesterday ? {} : { mobility: { rest: others.length > 0 ? `To log: ${list(others)}.` : null } }),
    };
  }

  if (kind === "afternoon") {
    const food = state.foodSavedAt === null;
    const steps = state.stepsSavedAt === null;
    const items = [food && "food so far (Healthify screenshots)", steps && "steps so far"].filter(Boolean) as string[];
    if (items.length === 0) return null;
    return {
      title: "Afternoon check-in",
      body: `To log: ${list(items)}.`,
      url: food ? "/food" : "/steps",
      tag: "afternoon",
    };
  }

  const since = (savedAt: Date | null) => savedAt !== null && savedAt.getTime() >= afternoonAt.getTime();
  const food = !since(state.foodSavedAt);
  const steps = !since(state.stepsSavedAt);
  const exercise = !state.exercise;
  const items = [
    food && "today’s food (Healthify screenshots)",
    steps && "today’s steps",
    exercise && "exercise, or “Did nothing today”",
  ].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return {
    title: "Evening check-in",
    body: `To log: ${list(items)}.`,
    url: food ? "/food" : exercise ? "/exercises" : "/steps",
    tag: "evening",
  };
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The logical days a reminder run needs: today and yesterday. */
export function reminderDays(now: Date): { today: LogicalDate; yesterday: LogicalDate } {
  const today = logicalDate(now);
  return { today, yesterday: addDays(today, -1) };
}
