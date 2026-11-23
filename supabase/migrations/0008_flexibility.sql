-- Nicholasfit: Flexibility tab (stretch sessions, flexibility tests, intensity levels, Claude's review).
-- One row per user holding a small JSON document. Safe to run more than once.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.flexibility (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.flexibility enable row level security;
drop policy if exists "Own flexibility" on public.flexibility;
create policy "Own flexibility" on public.flexibility
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
