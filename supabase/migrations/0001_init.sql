-- Nicholasfit: workouts table (Phase 1)
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  template_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  entries jsonb not null default '[]'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_started_idx
  on public.workouts (user_id, started_at desc);

alter table public.workouts enable row level security;

-- Each person can only see and change their own workouts.
create policy "Own workouts: select" on public.workouts
  for select using (auth.uid() = user_id);
create policy "Own workouts: insert" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "Own workouts: update" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own workouts: delete" on public.workouts
  for delete using (auth.uid() = user_id);
