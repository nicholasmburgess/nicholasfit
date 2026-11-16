-- Nicholasfit: Withings scale connection
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

create table if not exists public.withings_links (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  withings_userid text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  last_sync timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.withings_links enable row level security;
create policy "Own Withings link" on public.withings_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.body_weights add column if not exists fat_pct numeric;
