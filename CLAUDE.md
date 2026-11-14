# Personal Fitness PWA: Build Spec

Single-user personal fitness tracker, built as a PWA and installed on one Android phone. This file is the source of truth. Read it fully at the start of every session. If something here conflicts with a later chat instruction, ask before deviating.

## 0. Working agreements (read first)

- **Plan before code.** For every phase, propose a short plan and wait for approval before writing code.
- **One phase at a time.** Do not start the next phase or add features that are not in this spec. If an idea seems useful, suggest it and wait.
- **Small steps, commit often.** Commit to git after each working step with a clear message.
- **No secrets in code or chat.** Keys live in `.env.local` (server-side) or on the user's device (Gemini key). Never commit them, never log them.
- **Test the screenshot reader against real files** in `/test-screenshots` (Healthify screens supplied by the user). Do not guess layouts.
- **Explain simply.** The user is technically fluent (APIs, Claude Code, Supabase, Vercel) but is not a software engineer. Keep explanations short and plain.
- **Ask when a decision is genuinely the user's.** Otherwise pick the sensible default, state it in one line, and move on.

## 1. Platform and stack

- **PWA**, installed to the home screen on an Android phone (Samsung). Mobile-first, big tap targets, fast one-handed input.
- **Backend: Supabase** (Postgres, Auth, scheduled jobs / Edge Functions). Free plan assumed: 500 MB database, free projects pause after 7 days of inactivity (daily use avoids this).
- **Hosting: Vercel.**
- **Suggested front end:** React/Next.js with TypeScript. Claude Code may propose an alternative in the Phase 1 plan.
- **Push notifications:** Web Push (VAPID) via a service worker, triggered by a scheduled job on Supabase. Must fire when the app is closed.
- **Screenshot reading: Gemini API**, called with a key the user pastes into Settings. The key is stored **only on the device** (never in code, database or logs). Recommend restricting the key to the Gemini API in Google's console.
- **No native Android in v1.** Native + Health Connect is a possible later step only if manual step entry becomes annoying.
- **Export:** an "Export my data" button (JSON/CSV) so the user can keep a backup in Drive.
- **Login:** single user. One Supabase Auth account, sign-ups disabled, row-level security so only that user can read or write data.

## 2. Global rules

- **Timezone:** Asia/Kolkata (IST).
- **Day rollover is 4:00 am, not midnight.** Anything logged between 00:00 and 03:59 belongs to the previous day. Implement one shared "logical date" helper and use it everywhere (logging, reminders, history, met/not-met).
- **Backfill:** every data type can be entered for any past day.
- **Units:** weight in kg; body circumference in inches.
- **Targets** are set in this app (Settings), not read from screenshots. Each target is stored with a **start date**, and every day is judged against the target that applied on that day. Changing a target never rewrites past days.
- **No photos stored, ever.** Screenshots are sent to Gemini, the numbers are extracted, and the image is discarded.
- **No internet lookups for nutrition data.** Never fetch macros from anywhere.
- **No chat window.** Anything needing confirmation uses a review screen with a Confirm button. Nothing from a screenshot is saved until the user confirms.
- **Met / not met** is evaluated per metric, never as one combined daily score. A day's final result is recorded the next day (after the 4 am rollover), except calories (see Food).
- **Editable names:** every exercise name can be renamed, and the new name applies to past logs too.

## 3. Navigation

Sections: **Today** (home), **Food**, **Steps**, **Sleep**, **Mobility**, **Exercises**, **Body Vitals**, **History**, **Settings**.

Mobile bottom bars hold about five items, so use a "More" tab for the overflow. Propose the exact layout in the Phase 1 plan. Constraint: logging for the five daily areas must be reachable in one or two taps from Today.

**Today screen:** a checklist of what is logged and what is pending for the current logical day, with quick-entry for each area.

## 4. Sections

### 4.1 Food

Food data comes **only from Healthify screenshots** (plus rare manual entries). Track **calories, protein and fibre** only. Carbs and fats are ignored for now (nullable columns are fine, nothing shown).

**Meal slots:** Breakfast, Morning Snack, Lunch, Evening Snack, Dinner. If a screenshot shows another slot name, accept it as an extra slot.

**Healthify screens the reader must handle** (it must identify which screen each image is):
1. **Insights, "All Meals" tab:** day calories against budget, and grams of protein, fats, carbs, fibre against targets. This is the source of day totals.
2. **Insights, per-meal tab** (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner): calories and grams for that meal.
3. **Diary ("Today"):** items with calories and meal totals. Item names are **not** stored. Use it only if it helps cross-check.

**Rules**
- **Insights is the source of truth.** If the Diary differs slightly (e.g. 283 vs 282 cal), the Insights number wins.
- The user uploads **several screenshots at once** (All Meals plus one per meal eaten, up to about six). The reader works out which is which.
- **Review screen before saving:** shows the detected date (pre-filled from the 4 am rule, editable), each meal's calories/protein/fibre, anything missing (e.g. "no fibre shown for Lunch"), and what will be replaced. The user can edit any number. Nothing is saved until Confirm.
- **Replace-on-upload:** a per-meal screenshot replaces that meal only. An All Meals screenshot replaces the day totals. Meals not in the upload stay as they were. A re-upload **also replaces manually typed entries** it covers, and the review screen must say so (e.g. "This replaces Lunch, including 1 typed entry").
- **Day totals vs per-meal sums:** store both. Day-level metrics use the All Meals total if present, otherwise the sum of meals. Flag a mismatch on the review screen. (Confirm this design in the Phase 2 plan.)
- If Healthify does not show protein or fibre (e.g. paywalled), the review screen flags it and the user types the numbers.
- **Manual entry** (rare): the user types calories, protein, fibre for a meal slot and date. Counts toward totals.
- **Missing macros:** a day with missing protein or fibre is **unknown** for that metric and is excluded from hit rates. Never default missing values to zero.

**Food targets** (daily, in Settings): calories (stay **under**), protein (at least), fibre (at least). No per-meal targets; per-meal values are shown as plain numbers.

**Met rules**
- Calories: met means at or under target. Show **over target live** the moment it is crossed (calories only go up).
- Protein and fibre: met means at or above target, judged only after the day closes.

**Dropped from earlier ideas (do not build):** food library, frequent meals, "same as yesterday", meal photos, Gemini macro estimation, per-meal targets.

### 4.2 Steps

- Manual entry of the day's step count (v1). Screenshot reading may come later.
- **No "did nothing" option** for steps.
- Target in Settings; met means at or above target.

### 4.3 Sleep

- **Sleep score, 1 to 100** (the user reads it from Samsung Health), or **Skip** for days not logged.
- Defaults to last night so no date picking is needed.
- **No target.** Skipped days are shown as gaps and excluded from averages.

### 4.4 Mobility

- One big **yes / no** for the **previous day's** mobility session. Asked only if still unanswered.
- Can be answered from the notification itself if feasible.

### 4.5 Exercises

One section covering strength, timed holds, cardio and plyometrics. A **"Did nothing today"** option exists (counts as a rest day and stops the evening reminder).

**Structure:** templates for lifting, plus Cardio as its own section beside them.

**Templates**
- **Push Day, Pull Day, Leg Day, Plyometrics:** base lists below.
- **Upper** = Push + Pull. **Lower** = Leg list. **Full Body** = Push + Pull + Leg.
- Recommended design: exercises belong to a base list (Push, Pull, Leg, Plyometrics); Upper, Lower and Full Body are combined views, so an exercise added once appears everywhere it should. Confirm in the Phase 3 plan.
- **Behaviour:** selecting a template shows its exercises as a pick-list. The user selects the ones done that day. Each template has an **Add exercise** button; added exercises are saved to that template permanently. Any exercise can be renamed.

**Base lists**

Push Day (13): Dumbbell Press, Machine Chest Press, Dumbbell Flies, Cable Flies, Machine Flies, Dumbbell Shoulder Press, Machine Shoulder Press, Dumbbell Side Delts, Cable Side Delts, Tricep Rope Pushdown, Tricep Extension, Tricep Overhead Extension, Single Arm Tricep Cable Pushdown.

Pull Day (22): Lat Pulldown, Lat Pullover, Cable Rope Pulldown (upper back), Horizontal Cable Row, Back Extension, Good Morning, Barbell Row (upper back), Dumbbell Row (upper back), Dumbbell Row (lats), Face Pull (cable), Rear Delt Fly (cable), Dumbbell Preacher Curl, Cable Preacher Curl, Dumbbell Hammer Curl, Cable Hammer Curl, Cable Bicep Curl, Pull-up, Assisted Pull-up, Dead Hang, Dumbbell Shrug, Barbell Curl, Behind-the-Arm Cable Curl.

Leg Day (17): Dumbbell Squat, Barbell Squat, Machine Squat, Leg Extension (quads), Standing Hamstring Curl, Horizontal Leg Press, Lying Hamstring Curl, Romanian Deadlift, Barbell Hip Thrust, Walking Lunge (forward), Bulgarian Split Squat, Standing Calf Raise, Cable Hip Abduction, Cable Hip Adduction, Dumbbell Goblet Squat, Nordic Hamstring Curl, Sissy Squat.

Plyometrics (7): Box Jump, Squat Jump, Jump Lunge, Broad Jump, Skater Jump, Pogo Hops, Medicine Ball Slam. (Depth Jump deliberately excluded for now.)

Cardio section (3): Treadmill Jogging, Cross Trainer, HIIT.

**Logging formats**
- **Strength:** one row per set with **reps** and **weight (kg)**. For Assisted Pull-up, weight means the assistance amount.
- **Dead Hang (timed):** sets logged as **seconds** (e.g. 50 s, 60 s), not reps and weight.
- **Cardio:** logged once per session, not per set.
  - Treadmill Jogging: duration, distance, speed, incline (optional)
  - Cross Trainer: duration, distance, resistance level (optional)
  - HIIT: rounds, work seconds, rest seconds, total duration
- **Plyometrics:** sets and reps (jumps), optional box height or added weight.
- **Last session reference:** when the user opens an exercise to log it, show its previous session's sets.

### 4.6 Body Vitals

- **Weight (kg)** and circumference in **inches** at **waist, chest, hip, thigh**.
- Logged whenever the user has time or remembers (roughly weekly). **No reminders, no pressure**; skipping weeks is normal.
- History: a trend chart per measurement and the **change over 30 and 90 days**.

## 5. Reminders (push notifications)

Each reminder is **skipped if the thing is already logged**. Times are IST. Tapping opens the right input directly.

- **8:00 am, morning check-in** (one combined notification): yesterday's steps (only if not logged), last night's sleep score, yesterday's mobility.
- **1:30 pm, afternoon check-in:** food (screenshots so far) and today's steps so far.
- **8:00 pm, evening check-in:** food, today's steps so far, and exercises (stops once a workout or "Did nothing today" is logged).
- **Body Vitals:** none.

Reminder times should be editable in Settings. The scheduled job runs server-side on Supabase and respects the 4 am logical day.

## 6. History (own section; history and trends together)

One screen per area. Targets shown are the ones that applied on each day.

- **Food:** daily calories, protein and fibre against that day's target with a met marker; charts by week, month and all time with a target line; hit rate per metric and streaks; tap a day to see per-meal numbers. Unknown days excluded from hit rates.
- **Steps:** number of days the target was met; average steps over the last **7, 31 and 90 days**; daily chart with target line.
- **Sleep:** score over time as a line; average over 7, 31 and 90 days; skipped days shown as gaps.
- **Mobility:** calendar of done / not done; percentage done over 7, 31 and 90 days; current and best streaks.
- **Exercises** (one combined screen):
  - Rolling 7-day view: number of days with any workout, plus **separate counts** for cardio, weights and plyometrics.
  - **Progression per exercise** (top weight and estimated one-rep max over time).
  - **Personal bests:** heaviest weight, most reps at a given weight, best estimated one-rep max, longest dead hang.
  - **Volume** (sets x reps x weight): per session, weekly totals, and by template (push, pull, legs).
  - Cardio: duration and distance over time per cardio type.
  - No weekly workout target.
- **Body Vitals:** trend chart per measurement, change over 30 and 90 days.

## 7. Settings

- Gemini API key (stored on the device only).
- Targets with start dates: calories (under), protein (at least), fibre (at least), steps (at least).
- Reminder times.
- Export my data.

## 8. Suggested data model (Claude Code may refine in Phase 1)

targets (metric, value, start_date) / food_meals (date, slot, calories, protein_g, fibre_g, source: screenshot|manual) / food_day_totals (date, calories, protein_g, fibre_g) / steps (date, count) / sleep (date, score or skipped) / mobility (date, done) / exercises (name, type: strength|timed|cardio|plyo, base_list, archived) / workout_sessions (date, template) / sets (session, exercise, set_no, reps, weight_kg, seconds) / cardio_sessions (date, type, fields) / rest_days (date) / body_vitals (date, weight_kg, waist_in, chest_in, hip_in, thigh_in) / push_subscriptions / user_settings. All keyed to the single user, all with row-level security.

## 9. Build phases

Phases 1 to 4 are the harder logic and are meant for the strongest model. Phases 5 and 6 are standard and can use a cheaper one.

1. **Foundation:** project skeleton, Supabase schema, single-user auth with RLS, logical-date helper, settings and targets, Today screen, navigation. *Plan first, then build.*
2. **Food pipeline:** Gemini screenshot reader, screen-type detection, review screen, replace rules, manual entry, day totals, live over-calories, next-day met/not met. Test against `/test-screenshots`.
3. **Exercises:** templates, pick-lists, add and rename exercises, set logging, dead hang, cardio, plyometrics, "Did nothing today", last-session reference.
4. **Notifications and deployment:** service worker, Web Push, scheduled jobs on Supabase, deploy to Vercel, install on the phone and verify real notifications arrive when the app is closed.
5. **Simple sections:** Steps, Sleep, Mobility, Body Vitals.
6. **History and charts:** all history screens in section 6, plus export.

## 10. Known risks and open items

- **Healthify layout** must be verified against the real screenshots in `/test-screenshots` before the reader is finalised.
- **Insights macro numbers might be paywalled** in Healthify. If protein or fibre is missing, the review screen offers manual entry.
- **Push reliability on a PWA** is the riskiest part. Test on the real phone early in Phase 4.
- **Supabase free projects pause after 7 days of inactivity.** If paused, reactivate manually. Keep the export backup current.
- **Navigation layout** is to be proposed in Phase 1.
- **Version 2 ideas (not now):** screenshot-based step reading, Samsung Health sync via Health Connect (needs a native wrapper).
