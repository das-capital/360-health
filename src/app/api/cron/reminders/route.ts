import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReminder,
  DEFAULT_TIMES,
  dueReminders,
  istMoment,
  reminderDays,
  type HandledAt,
  type LoggedState,
  type ReminderKind,
  type ReminderTimes,
} from "@/lib/reminders";
import { sendPush, type StoredSubscription } from "@/lib/server/push";
import { adminClient } from "@/lib/server/supabase";

/**
 * Called every few minutes by the scheduled job on Supabase. Works out which
 * check-ins are due and sends them. Protected by a shared secret, because
 * nobody is logged in when it runs.
 */
export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const db = adminClient();
    const now = new Date();

    const { data: subs, error } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");
    if (error) throw new Error(error.message);

    // Only users with at least one device to notify (in practice: the one user).
    const byUser = new Map<string, StoredSubscription[]>();
    for (const sub of subs ?? []) {
      byUser.set(sub.user_id, [...(byUser.get(sub.user_id) ?? []), sub]);
    }

    const results = [];
    for (const [userId, devices] of byUser) {
      results.push(...(await runForUser(db, userId, devices, now)));
    }
    return NextResponse.json({ at: now.toISOString(), results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

async function runForUser(db: SupabaseClient, userId: string, devices: StoredSubscription[], now: Date) {
  const { today, yesterday } = reminderDays(now);

  const [settings, log] = await Promise.all([
    db
      .from("user_settings")
      .select("reminder_morning, reminder_afternoon, reminder_evening")
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("reminder_log").select("kind, created_at").eq("user_id", userId).eq("date", today),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (log.error) throw new Error(log.error.message);

  const times: ReminderTimes = settings.data
    ? {
        morning: String(settings.data.reminder_morning).slice(0, 5),
        afternoon: String(settings.data.reminder_afternoon).slice(0, 5),
        evening: String(settings.data.reminder_evening).slice(0, 5),
      }
    : DEFAULT_TIMES;

  const handledAt: HandledAt = {};
  for (const row of log.data ?? []) handledAt[row.kind as ReminderKind] = new Date(row.created_at);

  const due = dueReminders(now, times, handledAt);
  if (due.length === 0) return [];

  const state = await loadState(db, userId, today, yesterday);
  const results = [];

  for (const kind of due) {
    const reminder = buildReminder(kind, state, istMoment(today, times.afternoon));

    // Claim this reminder first. If another run already claimed it, do nothing:
    // this is what stops the same reminder going out twice.
    const staleBefore = handledAt[kind] ? istMoment(today, times[kind]) : null;
    const claimed = await claim(db, userId, today, kind, reminder !== null, staleBefore, now);
    if (!claimed) continue;

    if (!reminder) {
      results.push({ kind, sent: false, reason: "already logged" });
      continue;
    }

    const { mobility, ...message } = reminder;
    const outcome = await sendPush(devices, {
      ...message,
      // The mobility buttons answer for yesterday, even if tapped after the day rolls over.
      ...(mobility ? { mobility: { date: yesterday, rest: mobility.rest } } : {}),
    });
    if (outcome.expiredIds.length > 0) {
      await db.from("push_subscriptions").delete().in("id", outcome.expiredIds);
    }
    results.push({ kind, sent: outcome.delivered > 0, delivered: outcome.delivered, errors: outcome.errors });
  }
  return results;
}

/**
 * Mark a check-in as handled for the day. Returns false if another run got
 * there first. An older entry (from before the reminder time was moved later)
 * is taken over rather than duplicated.
 */
async function claim(
  db: SupabaseClient,
  userId: string,
  today: string,
  kind: ReminderKind,
  sent: boolean,
  /** Set when an older entry exists: it was made before this moment (the new reminder time). */
  staleBefore: Date | null,
  now: Date,
): Promise<boolean> {
  if (staleBefore) {
    const { data, error } = await db
      .from("reminder_log")
      .update({ sent, created_at: now.toISOString() })
      .eq("user_id", userId)
      .eq("date", today)
      .eq("kind", kind)
      .lt("created_at", staleBefore.toISOString())
      .select("kind");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }
  const { error } = await db.from("reminder_log").insert({ user_id: userId, date: today, kind, sent });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

/** What is logged right now, as far as the reminders care. */
async function loadState(db: SupabaseClient, userId: string, today: string, yesterday: string): Promise<LoggedState> {
  const mine = (table: string, columns: string) => db.from(table).select(columns).eq("user_id", userId);

  const [stepsY, sleep, mobilityY, meals, totals, stepsT, workouts, cardio, rest] = await Promise.all([
    mine("steps", "date").eq("date", yesterday).maybeSingle(),
    mine("sleep", "date").eq("date", today).maybeSingle(),
    mine("mobility", "date").eq("date", yesterday).maybeSingle(),
    mine("food_meals", "created_at").eq("date", today).order("created_at", { ascending: false }).limit(1),
    mine("food_day_totals", "updated_at").eq("date", today).maybeSingle(),
    mine("steps", "updated_at").eq("date", today).maybeSingle(),
    mine("workout_sessions", "id").eq("date", today).limit(1),
    mine("cardio_sessions", "id").eq("date", today).limit(1),
    mine("rest_days", "date").eq("date", today).maybeSingle(),
  ]);
  const failed = [stepsY, sleep, mobilityY, meals, totals, stepsT, workouts, cardio, rest].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const stamp = (row: unknown, column: string): number | null => {
    const value = (row as Record<string, string> | null)?.[column];
    return value ? Date.parse(value) : null;
  };
  const foodTimes = [stamp(meals.data?.[0], "created_at"), stamp(totals.data, "updated_at")].filter(
    (t): t is number => t !== null,
  );
  const stepsAt = stamp(stepsT.data, "updated_at");

  return {
    stepsYesterday: stepsY.data !== null,
    sleep: sleep.data !== null,
    mobilityYesterday: mobilityY.data !== null,
    foodSavedAt: foodTimes.length > 0 ? new Date(Math.max(...foodTimes)) : null,
    stepsSavedAt: stepsAt !== null ? new Date(stepsAt) : null,
    exercise: (workouts.data?.length ?? 0) > 0 || (cardio.data?.length ?? 0) > 0 || rest.data !== null,
  };
}
