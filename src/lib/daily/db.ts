import type { LogicalDate } from "../logical-date";
import { currentUserId, getSupabase } from "../supabase/client";
import type { VitalKey, Vitals } from "./rules";

/** Database access for Steps, Sleep, Mobility and Body Vitals. One entry per day each. */

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- steps

export async function loadSteps(date: LogicalDate): Promise<number | null> {
  const { data, error } = await getSupabase().from("steps").select("count").eq("date", date).maybeSingle();
  fail(error);
  return data ? (data.count as number) : null;
}

/** Saving again for the same day overwrites: the count is "steps so far". */
export async function saveSteps(date: LogicalDate, count: number): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("steps")
    .upsert({ user_id, date, count, updated_at: new Date().toISOString() }, { onConflict: "user_id,date" });
  fail(error);
}

export async function deleteSteps(date: LogicalDate): Promise<void> {
  const { error } = await getSupabase().from("steps").delete().eq("date", date);
  fail(error);
}

// ---------------------------------------------------------------- sleep

/** A night is stored under the day you woke up. */
export type SleepEntry = { score: number | null; skipped: boolean };

export async function loadSleep(date: LogicalDate): Promise<SleepEntry | null> {
  const { data, error } = await getSupabase().from("sleep").select("score, skipped").eq("date", date).maybeSingle();
  fail(error);
  return data as SleepEntry | null;
}

/** A score from 1 to 100, or null to record the night as skipped. */
export async function saveSleep(date: LogicalDate, score: number | null): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("sleep")
    .upsert(
      { user_id, date, score, skipped: score === null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );
  fail(error);
}

export async function deleteSleep(date: LogicalDate): Promise<void> {
  const { error } = await getSupabase().from("sleep").delete().eq("date", date);
  fail(error);
}

// ------------------------------------------------------------- mobility

export async function loadMobility(date: LogicalDate): Promise<boolean | null> {
  const { data, error } = await getSupabase().from("mobility").select("done").eq("date", date).maybeSingle();
  fail(error);
  return data ? (data.done as boolean) : null;
}

export async function saveMobility(date: LogicalDate, done: boolean): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("mobility")
    .upsert({ user_id, date, done, updated_at: new Date().toISOString() }, { onConflict: "user_id,date" });
  fail(error);
}

export async function deleteMobility(date: LogicalDate): Promise<void> {
  const { error } = await getSupabase().from("mobility").delete().eq("date", date);
  fail(error);
}

// ---------------------------------------------------------- body vitals

export type VitalsRow = { date: LogicalDate } & Record<VitalKey, number | null>;

const VITAL_COLUMNS = "date, weight_kg, waist_in, chest_in, hip_in, thigh_in";

/** The entry for one day, and the most recent entry before it (for reference). */
export async function loadVitals(date: LogicalDate): Promise<{ entry: VitalsRow | null; previous: VitalsRow | null }> {
  const db = getSupabase();
  const [entry, previous] = await Promise.all([
    db.from("body_vitals").select(VITAL_COLUMNS).eq("date", date).maybeSingle(),
    db.from("body_vitals").select(VITAL_COLUMNS).lt("date", date).order("date", { ascending: false }).limit(1),
  ]);
  fail(entry.error);
  fail(previous.error);
  return {
    entry: entry.data as VitalsRow | null,
    previous: ((previous.data ?? [])[0] as VitalsRow | undefined) ?? null,
  };
}

/**
 * One entry per day. Only the measurements given are written, so a second
 * save on the same day leaves the others as they were.
 */
export async function saveVitals(date: LogicalDate, values: Vitals): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("body_vitals")
    .upsert({ user_id, date, ...values, updated_at: new Date().toISOString() }, { onConflict: "user_id,date" });
  fail(error);
}

export async function deleteVitals(date: LogicalDate): Promise<void> {
  const { error } = await getSupabase().from("body_vitals").delete().eq("date", date);
  fail(error);
}
