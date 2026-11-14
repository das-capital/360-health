-- Personal Fitness PWA: initial schema (Phase 1).
-- Run this once in the Supabase SQL Editor.
--
-- Every table is keyed to the single user through user_id (filled in
-- automatically from the logged-in session) and protected by row-level
-- security, so only that user can read or write their rows.
--
-- All "date" columns hold the LOGICAL date (IST, day rolls over at 4:00 am),
-- worked out by the app's shared helper. They are never derived from now().

-- ---------------------------------------------------------------- targets
-- A new row is added whenever a target changes. Old rows are never edited,
-- so each day is judged against the target that applied on that day.
create table public.targets (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric      text not null check (metric in ('calories', 'protein', 'fibre', 'steps')),
  value       numeric not null check (value > 0),
  start_date  date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, metric, start_date)
);

-- ------------------------------------------------------------------- food
-- Several rows per meal slot are allowed (e.g. a screenshot plus a typed entry).
-- Null protein / fibre means "unknown", never zero.
create table public.food_meals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  slot        text not null,
  calories    numeric check (calories >= 0),
  protein_g   numeric check (protein_g >= 0),
  fibre_g     numeric check (fibre_g >= 0),
  carbs_g     numeric check (carbs_g >= 0),
  fat_g       numeric check (fat_g >= 0),
  source      text not null check (source in ('screenshot', 'manual')),
  created_at  timestamptz not null default now()
);
create index food_meals_user_date_idx on public.food_meals (user_id, date);

-- Day totals from the Healthify "All Meals" screen.
create table public.food_day_totals (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  calories    numeric check (calories >= 0),
  protein_g   numeric check (protein_g >= 0),
  fibre_g     numeric check (fibre_g >= 0),
  carbs_g     numeric check (carbs_g >= 0),
  fat_g       numeric check (fat_g >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ------------------------------------------------------------------ steps
create table public.steps (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  count       integer not null check (count >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ------------------------------------------------------------------ sleep
-- date = the day you woke up (same as Samsung Health shows it).
-- Either a score from 1 to 100, or skipped.
create table public.sleep (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  score       integer check (score between 1 and 100),
  skipped     boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date),
  check ((skipped and score is null) or (not skipped and score is not null))
);

-- --------------------------------------------------------------- mobility
-- date = the day the session was (or was not) done.
create table public.mobility (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  done        boolean not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- -------------------------------------------------------------- exercises
-- Each exercise belongs to one base list. Upper / Lower / Full Body are
-- combined views built in the app. The lists are filled in Phase 3.
create table public.exercises (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('strength', 'timed', 'cardio', 'plyo')),
  base_list   text not null check (base_list in ('push', 'pull', 'leg', 'plyo', 'cardio')),
  archived    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index exercises_user_list_idx on public.exercises (user_id, base_list);

create table public.workout_sessions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  template    text not null,
  created_at  timestamptz not null default now()
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, date);

-- One row per set. Strength uses reps + weight_kg, timed holds use seconds.
create table public.sets (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id   bigint not null references public.workout_sessions (id) on delete cascade,
  exercise_id  bigint not null references public.exercises (id),
  set_no       integer not null check (set_no > 0),
  reps         integer check (reps >= 0),
  weight_kg    numeric check (weight_kg >= 0),
  seconds      integer check (seconds >= 0),
  created_at   timestamptz not null default now()
);
create index sets_session_idx on public.sets (session_id);
create index sets_user_exercise_idx on public.sets (user_id, exercise_id);

-- One row per cardio session. "fields" holds the type-specific numbers
-- (duration, distance, speed, incline, resistance, rounds, ...).
create table public.cardio_sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null,
  exercise_id  bigint not null references public.exercises (id),
  fields       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index cardio_sessions_user_date_idx on public.cardio_sessions (user_id, date);

-- "Did nothing today".
create table public.rest_days (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ------------------------------------------------------------ body vitals
create table public.body_vitals (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  weight_kg   numeric check (weight_kg > 0),
  waist_in    numeric check (waist_in > 0),
  chest_in    numeric check (chest_in > 0),
  hip_in      numeric check (hip_in > 0),
  thigh_in    numeric check (thigh_in > 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------------------------------------------------- push + user settings
create table public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Reminder times are IST wall-clock times.
create table public.user_settings (
  user_id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reminder_morning    time not null default '08:00',
  reminder_afternoon  time not null default '13:30',
  reminder_evening    time not null default '20:00',
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------- row-level security
-- Same rule on every table: a logged-in user sees and changes only their own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'targets', 'food_meals', 'food_day_totals', 'steps', 'sleep', 'mobility',
    'exercises', 'workout_sessions', 'sets', 'cardio_sessions', 'rest_days',
    'body_vitals', 'push_subscriptions', 'user_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) '
      'with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
