-- Phase 4: reminders.
-- Run this once in the Supabase SQL Editor (after 0001 to 0003). Safe to run again.
--
-- This file creates the log that stops a reminder going out twice, and turns
-- on the two database features the scheduled job needs. The job itself is
-- created by a separate, private SQL file (it contains a secret, so it is not
-- kept in the code repository).

-- One row per check-in per logical day, written the moment it is handled.
-- sent = false means it was skipped because everything was already logged.
create table if not exists public.reminder_log (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('morning', 'afternoon', 'evening')),
  sent        boolean not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, date, kind)
);

alter table public.reminder_log enable row level security;

-- The owner may read their own log. Only the server (secret key) writes to it.
drop policy if exists "owner can read" on public.reminder_log;
create policy "owner can read" on public.reminder_log
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Steps saved again later in the day must show a fresh time, so the evening
-- check-in can tell an evening entry from a lunchtime one.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists steps_touch_updated_at on public.steps;
create trigger steps_touch_updated_at
  before update on public.steps
  for each row execute function public.touch_updated_at();

-- Scheduler and outgoing web requests, used by the reminder job.
create extension if not exists pg_cron;
create extension if not exists pg_net;
