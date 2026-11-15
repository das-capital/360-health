-- Phase 3: exercises.
-- Run this once in the Supabase SQL Editor (after 0001 and 0002).
-- It is safe to run again: nothing is duplicated.

-- Plyometrics can record a box height (inches).
alter table public.sets
  add column if not exists box_height_in numeric check (box_height_in > 0);

-- Names can be changed by the user, so behaviour that depends on a specific
-- exercise is stored in its own column instead of being guessed from the name.
alter table public.exercises
  add column if not exists assisted boolean not null default false,   -- weight means assistance (Assisted Pull-up)
  add column if not exists cardio_kind text
    check (cardio_kind in ('treadmill', 'cross_trainer', 'hiit'));    -- which cardio form to show

-- No two exercises with the same name (ignoring capitals).
create unique index if not exists exercises_user_name_idx
  on public.exercises (user_id, lower(name));

-- One session per template per day: reopening Push Day continues the same session.
create unique index if not exists workout_sessions_user_date_template_idx
  on public.workout_sessions (user_id, date, template);

-- The starting lists from the spec.
insert into public.exercises (user_id, name, type, base_list, sort_order, assisted, cardio_kind)
select u.id, v.name, v.type, v.base_list, v.sort_order, v.assisted, v.cardio_kind
from auth.users u
cross join (
  values
    -- Push Day (13)
    ('Dumbbell Press',                   'strength', 'push',  1, false, null),
    ('Machine Chest Press',              'strength', 'push',  2, false, null),
    ('Dumbbell Flies',                   'strength', 'push',  3, false, null),
    ('Cable Flies',                      'strength', 'push',  4, false, null),
    ('Machine Flies',                    'strength', 'push',  5, false, null),
    ('Dumbbell Shoulder Press',          'strength', 'push',  6, false, null),
    ('Machine Shoulder Press',           'strength', 'push',  7, false, null),
    ('Dumbbell Side Delts',              'strength', 'push',  8, false, null),
    ('Cable Side Delts',                 'strength', 'push',  9, false, null),
    ('Tricep Rope Pushdown',             'strength', 'push', 10, false, null),
    ('Tricep Extension',                 'strength', 'push', 11, false, null),
    ('Tricep Overhead Extension',        'strength', 'push', 12, false, null),
    ('Single Arm Tricep Cable Pushdown', 'strength', 'push', 13, false, null),
    -- Pull Day (22)
    ('Lat Pulldown',                     'strength', 'pull',  1, false, null),
    ('Lat Pullover',                     'strength', 'pull',  2, false, null),
    ('Cable Rope Pulldown (upper back)', 'strength', 'pull',  3, false, null),
    ('Horizontal Cable Row',             'strength', 'pull',  4, false, null),
    ('Back Extension',                   'strength', 'pull',  5, false, null),
    ('Good Morning',                     'strength', 'pull',  6, false, null),
    ('Barbell Row (upper back)',         'strength', 'pull',  7, false, null),
    ('Dumbbell Row (upper back)',        'strength', 'pull',  8, false, null),
    ('Dumbbell Row (lats)',              'strength', 'pull',  9, false, null),
    ('Face Pull (cable)',                'strength', 'pull', 10, false, null),
    ('Rear Delt Fly (cable)',            'strength', 'pull', 11, false, null),
    ('Dumbbell Preacher Curl',           'strength', 'pull', 12, false, null),
    ('Cable Preacher Curl',              'strength', 'pull', 13, false, null),
    ('Dumbbell Hammer Curl',             'strength', 'pull', 14, false, null),
    ('Cable Hammer Curl',                'strength', 'pull', 15, false, null),
    ('Cable Bicep Curl',                 'strength', 'pull', 16, false, null),
    ('Pull-up',                          'strength', 'pull', 17, false, null),
    ('Assisted Pull-up',                 'strength', 'pull', 18, true,  null),
    ('Dead Hang',                        'timed',    'pull', 19, false, null),
    ('Dumbbell Shrug',                   'strength', 'pull', 20, false, null),
    ('Barbell Curl',                     'strength', 'pull', 21, false, null),
    ('Behind-the-Arm Cable Curl',        'strength', 'pull', 22, false, null),
    -- Leg Day (17)
    ('Dumbbell Squat',                   'strength', 'leg',   1, false, null),
    ('Barbell Squat',                    'strength', 'leg',   2, false, null),
    ('Machine Squat',                    'strength', 'leg',   3, false, null),
    ('Leg Extension (quads)',            'strength', 'leg',   4, false, null),
    ('Standing Hamstring Curl',          'strength', 'leg',   5, false, null),
    ('Horizontal Leg Press',             'strength', 'leg',   6, false, null),
    ('Lying Hamstring Curl',             'strength', 'leg',   7, false, null),
    ('Romanian Deadlift',                'strength', 'leg',   8, false, null),
    ('Barbell Hip Thrust',               'strength', 'leg',   9, false, null),
    ('Walking Lunge (forward)',          'strength', 'leg',  10, false, null),
    ('Bulgarian Split Squat',            'strength', 'leg',  11, false, null),
    ('Standing Calf Raise',              'strength', 'leg',  12, false, null),
    ('Cable Hip Abduction',              'strength', 'leg',  13, false, null),
    ('Cable Hip Adduction',              'strength', 'leg',  14, false, null),
    ('Dumbbell Goblet Squat',            'strength', 'leg',  15, false, null),
    ('Nordic Hamstring Curl',            'strength', 'leg',  16, false, null),
    ('Sissy Squat',                      'strength', 'leg',  17, false, null),
    -- Plyometrics (7)
    ('Box Jump',                         'plyo',     'plyo',  1, false, null),
    ('Squat Jump',                       'plyo',     'plyo',  2, false, null),
    ('Jump Lunge',                       'plyo',     'plyo',  3, false, null),
    ('Broad Jump',                       'plyo',     'plyo',  4, false, null),
    ('Skater Jump',                      'plyo',     'plyo',  5, false, null),
    ('Pogo Hops',                        'plyo',     'plyo',  6, false, null),
    ('Medicine Ball Slam',               'plyo',     'plyo',  7, false, null),
    -- Cardio (3)
    ('Treadmill Jogging',                'cardio',   'cardio', 1, false, 'treadmill'),
    ('Cross Trainer',                    'cardio',   'cardio', 2, false, 'cross_trainer'),
    ('HIIT',                             'cardio',   'cardio', 3, false, 'hiit')
) as v (name, type, base_list, sort_order, assisted, cardio_kind)
on conflict do nothing;
