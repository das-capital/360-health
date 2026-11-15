import type { LogicalDate } from "../logical-date";
import { currentUserId, getSupabase } from "../supabase/client";
import type { BaseList, CardioRow, DayLog, Exercise, ExerciseType, SetRow, SetValues } from "./types";

const SET_COLUMNS = "id, session_id, exercise_id, set_no, reps, weight_kg, seconds, box_height_in";

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function loadExercises(): Promise<Exercise[]> {
  const data = check(
    await getSupabase()
      .from("exercises")
      .select("id, name, type, base_list, assisted, cardio_kind, sort_order")
      .eq("archived", false)
      .order("sort_order")
      .order("name"),
  );
  return data as Exercise[];
}

/** Everything logged under Exercises for one day. */
export async function loadDayLog(date: LogicalDate): Promise<DayLog> {
  const db = getSupabase();
  const [sessions, cardio, rest] = await Promise.all([
    db.from("workout_sessions").select(`id, template, sets(${SET_COLUMNS})`).eq("date", date).order("created_at"),
    db.from("cardio_sessions").select("id, exercise_id, fields").eq("date", date).order("created_at"),
    db.from("rest_days").select("date").eq("date", date).maybeSingle(),
  ]);
  const rows = check(sessions) as { id: number; template: string; sets: SetRow[] }[];
  return {
    sessions: rows.map(({ id, template }) => ({ id, template })),
    sets: rows.flatMap((s) => s.sets).sort((a, b) => a.set_no - b.set_no || a.id - b.id),
    cardio: check(cardio) as CardioRow[],
    rest: check(rest) !== null,
  };
}

/**
 * The session for this template on this day, created if it does not exist yet.
 * Logging a workout also cancels a "Did nothing today" for that day.
 */
async function ensureSession(date: LogicalDate, template: string): Promise<number> {
  const db = getSupabase();
  const user_id = await currentUserId();
  const session = check(
    await db
      .from("workout_sessions")
      .upsert({ user_id, date, template }, { onConflict: "user_id,date,template" })
      .select("id")
      .single(),
  );
  check(await db.from("rest_days").delete().eq("date", date));
  if (!session) throw new Error("Could not start the workout session.");
  return session.id as number;
}

export async function addSet(
  date: LogicalDate,
  template: string,
  exerciseId: number,
  setNo: number,
  values: SetValues,
): Promise<void> {
  const session_id = await ensureSession(date, template);
  const user_id = await currentUserId();
  check(
    await getSupabase()
      .from("sets")
      .insert({ user_id, session_id, exercise_id: exerciseId, set_no: setNo, ...values }),
  );
}

export async function updateSet(id: number, values: SetValues): Promise<void> {
  check(await getSupabase().from("sets").update(values).eq("id", id));
}

/** Delete a set. A session left with no sets is removed too, so it does not count as a workout. */
export async function deleteSet(set: Pick<SetRow, "id" | "session_id">): Promise<void> {
  const db = getSupabase();
  check(await db.from("sets").delete().eq("id", set.id));
  const left = check(await db.from("sets").select("id").eq("session_id", set.session_id).limit(1));
  if ((left as unknown[]).length === 0) {
    check(await db.from("workout_sessions").delete().eq("id", set.session_id));
  }
}

/** The most recent earlier day this exercise was done, with its sets. */
export async function loadLastSession(
  exerciseId: number,
  before: LogicalDate,
): Promise<{ date: LogicalDate; sets: SetRow[] } | null> {
  const data = check(
    await getSupabase()
      .from("workout_sessions")
      .select(`date, sets!inner(${SET_COLUMNS})`)
      .eq("sets.exercise_id", exerciseId)
      .lt("date", before)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ) as { date: LogicalDate; sets: SetRow[] }[];
  if (data.length === 0) return null;
  return { date: data[0].date, sets: [...data[0].sets].sort((a, b) => a.set_no - b.set_no || a.id - b.id) };
}

export async function addExercise(entry: {
  name: string;
  type: ExerciseType;
  base_list: BaseList;
  sort_order: number;
}): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase().from("exercises").insert({ user_id, ...entry });
  if (error) throw new Error(nameError(error));
}

/** Rename an exercise. Past logs point at the exercise itself, so they show the new name too. */
export async function renameExercise(id: number, name: string): Promise<void> {
  const { error } = await getSupabase().from("exercises").update({ name }).eq("id", id);
  if (error) throw new Error(nameError(error));
}

function nameError(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "An exercise with that name already exists." : error.message;
}

export async function addCardio(
  date: LogicalDate,
  exerciseId: number,
  fields: Record<string, number>,
): Promise<void> {
  const db = getSupabase();
  const user_id = await currentUserId();
  check(await db.from("cardio_sessions").insert({ user_id, date, exercise_id: exerciseId, fields }));
  check(await db.from("rest_days").delete().eq("date", date));
}

export async function deleteCardio(id: number): Promise<void> {
  check(await getSupabase().from("cardio_sessions").delete().eq("id", id));
}

/** "Did nothing today". */
export async function setRestDay(date: LogicalDate, rest: boolean): Promise<void> {
  const db = getSupabase();
  if (!rest) {
    check(await db.from("rest_days").delete().eq("date", date));
    return;
  }
  const user_id = await currentUserId();
  check(await db.from("rest_days").upsert({ user_id, date }, { onConflict: "user_id,date" }));
}
