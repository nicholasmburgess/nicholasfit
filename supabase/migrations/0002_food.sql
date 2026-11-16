-- Nicholasfit: food logging, body weight and profile (Phase 2)
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.meals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  description text not null default '',
  items jsonb not null default '[]'::jsonb,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  confidence text,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

create table if not exists public.body_weights (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  kg numeric not null,
  source text not null default 'manual'
);
create index if not exists body_weights_user_measured_idx on public.body_weights (user_id, measured_at desc);

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_cm numeric not null,
  sex text not null,
  birth_year int not null,
  updated_at timestamptz not null default now()
);

alter table public.meals enable row level security;
alter table public.body_weights enable row level security;
alter table public.profiles enable row level security;

-- Each person can only see and change their own rows.
create policy "Own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own weights" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
