-- Phase 2: save a reviewed food upload in one step.
-- Run this once in the Supabase SQL Editor (after 0001_init.sql).
--
-- Everything inside a function runs as a single transaction, so a replace
-- either fully happens or not at all: old entries are never deleted without
-- the new ones going in.
--
-- p_replace_slots : meal slots whose existing entries (screenshot AND typed) are removed
-- p_meals         : new meal entries, a JSON array of
--                   { slot, calories, protein_g, fibre_g, carbs_g, fat_g, source }
-- p_day_totals    : { calories, protein_g, fibre_g, carbs_g, fat_g } from the
--                   All Meals screen, or null to leave the saved day total alone
--
-- It runs with the caller's own rights, so row-level security still applies.

create or replace function public.save_food_day(
  p_date           date,
  p_replace_slots  text[],
  p_meals          jsonb,
  p_day_totals     jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from public.food_meals
  where user_id = auth.uid()
    and date = p_date
    and slot = any (coalesce(p_replace_slots, '{}'));

  insert into public.food_meals (date, slot, calories, protein_g, fibre_g, carbs_g, fat_g, source)
  select
    p_date,
    m ->> 'slot',
    (m ->> 'calories')::numeric,
    (m ->> 'protein_g')::numeric,
    (m ->> 'fibre_g')::numeric,
    (m ->> 'carbs_g')::numeric,
    (m ->> 'fat_g')::numeric,
    m ->> 'source'
  from jsonb_array_elements(coalesce(p_meals, '[]'::jsonb)) as m;

  if p_day_totals is not null and jsonb_typeof(p_day_totals) = 'object' then
    insert into public.food_day_totals (date, calories, protein_g, fibre_g, carbs_g, fat_g, updated_at)
    values (
      p_date,
      (p_day_totals ->> 'calories')::numeric,
      (p_day_totals ->> 'protein_g')::numeric,
      (p_day_totals ->> 'fibre_g')::numeric,
      (p_day_totals ->> 'carbs_g')::numeric,
      (p_day_totals ->> 'fat_g')::numeric,
      now()
    )
    on conflict (user_id, date) do update set
      calories   = excluded.calories,
      protein_g  = excluded.protein_g,
      fibre_g    = excluded.fibre_g,
      carbs_g    = excluded.carbs_g,
      fat_g      = excluded.fat_g,
      updated_at = now();
  end if;
end;
$$;

revoke all on function public.save_food_day(date, text[], jsonb, jsonb) from public, anon;
grant execute on function public.save_food_day(date, text[], jsonb, jsonb) to authenticated;
