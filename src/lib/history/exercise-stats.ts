import type { BaseList, Exercise } from "../exercises/types";
import { addDays, type LogicalDate } from "../logical-date";
import { oneRepMax, weekStart } from "./stats";

/** One logged set with the day and session it belongs to. */
export type LoggedSet = {
  date: LogicalDate;
  session_id: number;
  template: string;
  exercise_id: number;
  reps: number | null;
  weight_kg: number | null;
  seconds: number | null;
};

export type CardioLog = { date: LogicalDate; exercise_id: number; fields: Record<string, number> };

type ExerciseInfo = Pick<Exercise, "id" | "type" | "base_list" | "assisted">;

/**
 * Volume of one set: reps × weight. Only ordinary strength sets count;
 * assisted exercises (weight = assistance), timed holds and plyometrics do not.
 */
export function setVolume(set: LoggedSet, exercise: ExerciseInfo | undefined): number {
  if (!exercise || exercise.type !== "strength" || exercise.assisted) return 0;
  return (set.reps ?? 0) * (set.weight_kg ?? 0);
}

export type WeekCounts = { any: number; weights: number; cardio: number; plyo: number };

/** Days with a workout in the 7 days ending on `end`, with separate counts by kind. */
export function rollingWeek(
  sets: LoggedSet[],
  cardio: CardioLog[],
  exercises: Map<number, ExerciseInfo>,
  end: LogicalDate,
): WeekCounts {
  const start = addDays(end, -6);
  const inWindow = (date: LogicalDate) => date >= start && date <= end;
  const weights = new Set<LogicalDate>();
  const plyo = new Set<LogicalDate>();
  const cardioDays = new Set<LogicalDate>();

  for (const set of sets) {
    if (!inWindow(set.date)) continue;
    (exercises.get(set.exercise_id)?.type === "plyo" ? plyo : weights).add(set.date);
  }
  for (const session of cardio) if (inWindow(session.date)) cardioDays.add(session.date);

  return {
    any: new Set([...weights, ...plyo, ...cardioDays]).size,
    weights: weights.size,
    cardio: cardioDays.size,
    plyo: plyo.size,
  };
}

export type VolumeList = "push" | "pull" | "leg";
export type Volume = Record<VolumeList, number> & { total: number };

const noVolume = (): Volume => ({ push: 0, pull: 0, leg: 0, total: 0 });

function addVolume(into: Volume, set: LoggedSet, exercises: Map<number, ExerciseInfo>) {
  const exercise = exercises.get(set.exercise_id);
  const volume = setVolume(set, exercise);
  if (volume === 0 || !exercise) return;
  const list: BaseList = exercise.base_list;
  // Split by the exercise's own list, so an Upper session divides into push and pull.
  if (list === "push" || list === "pull" || list === "leg") into[list] += volume;
  into.total += volume;
}

/** Volume per week (weeks start on Monday), oldest first. */
export function weeklyVolume(sets: LoggedSet[], exercises: Map<number, ExerciseInfo>): { week: LogicalDate; volume: Volume }[] {
  const weeks = new Map<LogicalDate, Volume>();
  for (const set of sets) {
    const week = weekStart(set.date);
    if (!weeks.has(week)) weeks.set(week, noVolume());
    addVolume(weeks.get(week)!, set, exercises);
  }
  return [...weeks.entries()]
    .filter(([, volume]) => volume.total > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume]) => ({ week, volume }));
}

/** Volume per session, newest first. */
export function sessionVolume(
  sets: LoggedSet[],
  exercises: Map<number, ExerciseInfo>,
): { session_id: number; date: LogicalDate; template: string; volume: Volume }[] {
  const sessions = new Map<number, { session_id: number; date: LogicalDate; template: string; volume: Volume }>();
  for (const set of sets) {
    if (!sessions.has(set.session_id)) {
      sessions.set(set.session_id, {
        session_id: set.session_id,
        date: set.date,
        template: set.template,
        volume: noVolume(),
      });
    }
    addVolume(sessions.get(set.session_id)!.volume, set, exercises);
  }
  return [...sessions.values()]
    .filter((s) => s.volume.total > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.session_id - a.session_id);
}

export type ProgressPoint = { date: LogicalDate; top: number; oneRm: number | null };

/**
 * One point per day an exercise was done.
 * Strength: top weight and best estimated one-rep max that day.
 * Assisted: `top` is the LEAST assistance used; no one-rep max.
 * Timed: `top` is the longest hold in seconds.
 */
export function progression(sets: LoggedSet[], exercise: ExerciseInfo): ProgressPoint[] {
  const days = new Map<LogicalDate, ProgressPoint>();
  for (const set of sets) {
    if (set.exercise_id !== exercise.id) continue;
    let value: number | null;
    let oneRm: number | null = null;
    if (exercise.type === "timed") value = set.seconds;
    else {
      value = set.weight_kg;
      if (exercise.type === "strength" && !exercise.assisted && value !== null && set.reps) {
        oneRm = oneRepMax(value, set.reps);
      }
    }
    if (value === null) continue;

    const day = days.get(set.date);
    if (!day) {
      days.set(set.date, { date: set.date, top: value, oneRm });
      continue;
    }
    day.top = exercise.assisted ? Math.min(day.top, value) : Math.max(day.top, value);
    if (oneRm !== null && (day.oneRm === null || oneRm > day.oneRm)) day.oneRm = oneRm;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type Best = { value: number; date: LogicalDate; reps?: number };

export type PersonalBests = {
  /** Heaviest weight lifted (strength), with the reps done at it. */
  heaviest: Best | null;
  /** Best estimated one-rep max (strength). */
  oneRm: Best | null;
  /** Most reps at each weight, heaviest weight first (strength). */
  repsAtWeight: { weight: number; reps: number; date: LogicalDate }[];
  /** Least assistance used (assisted exercises). */
  leastAssistance: Best | null;
  /** Longest hold in seconds (timed exercises). */
  longestHold: Best | null;
};

/** Personal bests for one exercise. The earliest day wins a tie. */
export function personalBests(sets: LoggedSet[], exercise: ExerciseInfo): PersonalBests {
  const bests: PersonalBests = { heaviest: null, oneRm: null, repsAtWeight: [], leastAssistance: null, longestHold: null };
  const repsAt = new Map<number, { weight: number; reps: number; date: LogicalDate }>();
  const mine = sets
    .filter((s) => s.exercise_id === exercise.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const set of mine) {
    if (exercise.type === "timed") {
      if (set.seconds !== null && (!bests.longestHold || set.seconds > bests.longestHold.value)) {
        bests.longestHold = { value: set.seconds, date: set.date };
      }
      continue;
    }
    if (exercise.type !== "strength" || set.weight_kg === null) continue;
    const weight = set.weight_kg;
    const reps = set.reps ?? 0;

    if (exercise.assisted) {
      if (!bests.leastAssistance || weight < bests.leastAssistance.value) {
        bests.leastAssistance = { value: weight, date: set.date, reps };
      }
      continue;
    }
    if (reps <= 0) continue;
    if (!bests.heaviest || weight > bests.heaviest.value || (weight === bests.heaviest.value && reps > (bests.heaviest.reps ?? 0))) {
      bests.heaviest = { value: weight, date: set.date, reps };
    }
    const estimate = oneRepMax(weight, reps);
    if (!bests.oneRm || estimate > bests.oneRm.value) bests.oneRm = { value: estimate, date: set.date, reps };
    const known = repsAt.get(weight);
    if (!known || reps > known.reps) repsAt.set(weight, { weight, reps, date: set.date });
  }

  bests.repsAtWeight = [...repsAt.values()].sort((a, b) => b.weight - a.weight);
  return bests;
}
