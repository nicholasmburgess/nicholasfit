-- Apple Health data sent by the iPhone app: daily recovery numbers and cardio sessions (e.g. Concept2 rows from ErgData).
create table if not exists public.health_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  steps integer,
  active_kcal integer,
  resting_hr numeric,
  hrv_ms numeric,
  sleep_min integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.health_days enable row level security;
drop policy if exists "Own health days" on public.health_days;
create policy "Own health days" on public.health_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.health_workouts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  activity text not null,
  started_at timestamptz not null,
  minutes numeric not null,
  distance_m integer,
  kcal integer,
  source text,
  primary key (user_id, id)
);
alter table public.health_workouts enable row level security;
drop policy if exists "Own health workouts" on public.health_workouts;
create policy "Own health workouts" on public.health_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
