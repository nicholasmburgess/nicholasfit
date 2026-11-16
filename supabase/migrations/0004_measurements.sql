-- Nicholasfit: body measurements (waist first). Safe to run more than once.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.body_measurements (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  kind text not null default 'waist',
  cm numeric not null
);
create index if not exists body_measurements_user_idx on public.body_measurements (user_id, kind, measured_at);
alter table public.body_measurements enable row level security;
drop policy if exists "Own measurements" on public.body_measurements;
create policy "Own measurements" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
