-- Draft only: this file is NOT applied to any database.
-- Apply through the Supabase SQL Editor only when access control is activated.
create table if not exists public.access_members (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  nickname_key text not null unique,
  password_hash text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'blocked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_login_at timestamptz,
  login_count integer not null default 0 check (login_count >= 0),
  constraint access_members_nickname_length check (char_length(nickname) between 2 and 20)
);

create table if not exists public.access_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.access_members(id) on delete cascade,
  token_hash char(64) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists access_sessions_member_idx on public.access_sessions(member_id);
create index if not exists access_sessions_expiry_idx on public.access_sessions(expires_at);

create table if not exists public.access_rate_limits (
  bucket char(64) primary key,
  hits integer not null default 0,
  started_at timestamptz not null default now()
);

-- Explicitly deny direct browser access to credentials, sessions, rate limits.
alter table public.access_members enable row level security;
alter table public.access_sessions enable row level security;
alter table public.access_rate_limits enable row level security;
revoke all on public.access_members, public.access_sessions, public.access_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.access_members, public.access_sessions, public.access_rate_limits to service_role;

-- Atomic DB-backed per-IP rate limit. Runs with caller privileges.
-- Execute is explicitly denied to public roles; only the server secret key may call it.
create or replace function public.access_throttle(p_bucket text, p_limit integer, p_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_hits integer;
  window_duration interval := make_interval(secs => greatest(1, least(p_seconds, 86400)));
begin
  if p_bucket !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid bucket';
  end if;
  insert into public.access_rate_limits(bucket, hits, started_at)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    hits = case when public.access_rate_limits.started_at + window_duration < now()
      then 1 else public.access_rate_limits.hits + 1 end,
    started_at = case when public.access_rate_limits.started_at + window_duration < now()
      then now() else public.access_rate_limits.started_at end
  returning hits into new_hits;
  return new_hits <= greatest(1, least(p_limit, 100));
end;
$$;
revoke execute on function public.access_throttle(text, integer, integer) from public, anon, authenticated;
grant execute on function public.access_throttle(text, integer, integer) to service_role;

-- Bootstrap administrator only AFTER signing up with the desired nickname:
-- Open the Supabase SQL Editor and manually approve exactly ONE chosen account.
-- Do NOT create a public route for promoting members to administrator.
-- Recommended maintenance (manual/periodic):
-- delete from public.access_sessions where expires_at < now();
-- delete from public.access_rate_limits where started_at < now() - interval '1 day';
