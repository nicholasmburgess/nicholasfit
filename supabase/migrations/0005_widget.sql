-- Home-screen widget: a personal key lets the iPhone widget read today's totals
-- and log meals without a login. Only a SHA-256 hash of the key is stored.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.widget_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.widget_tokens enable row level security;
drop policy if exists "Own widget token" on public.widget_tokens;
create policy "Own widget token" on public.widget_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Latest daily targets, saved by the app so the widget can show them.
alter table public.profiles add column if not exists targets jsonb;

create or replace function public.widget_user(p_token text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select user_id from public.widget_tokens
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.widget_user(text) from public, anon, authenticated;

create or replace function public.widget_summary(p_token text, p_day_start timestamptz, p_week_start timestamptz)
returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  uid uuid := public.widget_user(p_token);
begin
  if uid is null or length(p_token) < 32 then
    raise exception 'invalid widget key' using errcode = '28000';
  end if;
  return json_build_object(
    'kcal', coalesce((select sum(kcal) from public.meals where user_id = uid and eaten_at >= p_day_start and eaten_at < p_day_start + interval '1 day'), 0),
    'protein', coalesce((select sum(protein) from public.meals where user_id = uid and eaten_at >= p_day_start and eaten_at < p_day_start + interval '1 day'), 0),
    'targets', (select targets from public.profiles where user_id = uid),
    'sessions', (select count(*) from public.workouts where user_id = uid and finished_at >= p_week_start),
    'weight', (select kg from public.body_weights where user_id = uid order by measured_at desc limit 1)
  );
end;
$$;
revoke all on function public.widget_summary(text, timestamptz, timestamptz) from public;
grant execute on function public.widget_summary(text, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.widget_add_meal(p_token text, p_meal jsonb)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public.widget_user(p_token);
begin
  if uid is null or length(p_token) < 32 then
    raise exception 'invalid widget key' using errcode = '28000';
  end if;
  insert into public.meals (id, user_id, eaten_at, description, items, kcal, protein, carbs, fat, confidence)
  values (
    gen_random_uuid(), uid, now(),
    left(coalesce(p_meal->>'description', ''), 500),
    coalesce(p_meal->'items', '[]'::jsonb),
    coalesce((p_meal->>'kcal')::numeric, 0),
    coalesce((p_meal->>'protein')::numeric, 0),
    coalesce((p_meal->>'carbs')::numeric, 0),
    coalesce((p_meal->>'fat')::numeric, 0),
    p_meal->>'confidence'
  );
end;
$$;
revoke all on function public.widget_add_meal(text, jsonb) from public;
grant execute on function public.widget_add_meal(text, jsonb) to anon, authenticated;
