import type { Exercise } from "../exercises/types";
import type { DayTotalsRow, MealRow } from "../food/types";
import type { LogicalDate } from "../logical-date";
import { getSupabase } from "../supabase/client";
import type { Target } from "../targets";
import type { CardioLog, LoggedSet } from "./exercise-stats";

const PAGE = 1000;

/**
 * Every row of a table (the logged-in user's rows, by row-level security).
 * Supabase returns at most 1000 rows per request, so this reads page by page.
 */
export async function allRows<T>(table: string, columns: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from(table)
      .select(columns)
      .order(orderBy)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export const loadAllTargets = () => allRows<Target>("targets", "metric, value, start_date", "start_date");

export async function loadStepsHistory() {
  const [rows, targets] = await Promise.all([
    allRows<{ date: LogicalDate; count: number }>("steps", "date, count", "date"),
    loadAllTargets(),
  ]);
  return { rows, targets };
}

export const loadSleepHistory = () =>
  allRows<{ date: LogicalDate; score: number | null; skipped: boolean }>("sleep", "date, score, skipped", "date");

export const loadMobilityHistory = () => allRows<{ date: LogicalDate; done: boolean }>("mobility", "date, done", "date");

export type VitalsHistoryRow = {
  date: LogicalDate;
  weight_kg: number | null;
  waist_in: number | null;
  chest_in: number | null;
  hip_in: number | null;
  thigh_in: number | null;
};

export const loadVitalsHistory = () =>
  allRows<VitalsHistoryRow>("body_vitals", "date, weight_kg, waist_in, chest_in, hip_in, thigh_in", "date");

export async function loadFoodHistory() {
  const [meals, totals, targets] = await Promise.all([
    allRows<MealRow & { date: LogicalDate }>(
      "food_meals",
      "id, date, slot, calories, protein_g, fibre_g, source, created_at",
      "id",
    ),
    allRows<DayTotalsRow & { date: LogicalDate }>(
      "food_day_totals",
      "date, calories, protein_g, fibre_g, updated_at",
      "date",
    ),
    loadAllTargets(),
  ]);
  return { meals, totals, targets };
}

export async function loadExerciseHistory() {
  const [exercises, sessions, sets, cardio] = await Promise.all([
    // Archived exercises are included: their past logs still count.
    allRows<Exercise>("exercises", "id, name, type, base_list, assisted, cardio_kind, sort_order", "id"),
    allRows<{ id: number; date: LogicalDate; template: string }>("workout_sessions", "id, date, template", "id"),
    allRows<Omit<LoggedSet, "date" | "template">>(
      "sets",
      "id, session_id, exercise_id, reps, weight_kg, seconds",
      "id",
    ),
    allRows<CardioLog>("cardio_sessions", "id, date, exercise_id, fields", "id"),
  ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const logged: LoggedSet[] = [];
  for (const set of sets) {
    const session = sessionById.get(set.session_id);
    if (session) logged.push({ ...set, date: session.date, template: session.template });
  }
  return { exercises, sets: logged, cardio };
}
