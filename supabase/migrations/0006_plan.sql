-- Training plan the weekly coach adjusts (exercises, sets and rep ranges per routine).
create table if not exists public.training_plans (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.training_plans enable row level security;
drop policy if exists "Own plan" on public.training_plans;
create policy "Own plan" on public.training_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
