-- MAGI-WEB LINE member registry
-- Run once in the Supabase SQL Editor for the MAGI-WEB project.

create table if not exists public.magi_line_members (
  id uuid primary key default gen_random_uuid(),
  line_sub text not null unique,
  display_name text not null default '',
  picture_url text not null default '',
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  role text not null default 'member' check (role in ('admin','coach','player','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists magi_line_members_status_idx on public.magi_line_members(status);
create index if not exists magi_line_members_role_idx on public.magi_line_members(role);

alter table public.magi_line_members enable row level security;

-- Browser-side anon/authenticated clients must not read or modify this registry.
revoke all on table public.magi_line_members from anon, authenticated;

-- The Vercel server functions access this table only with SUPABASE_SERVICE_ROLE_KEY.
-- The very first LINE user inserted into an empty table becomes active/admin.
-- All later LINE users are inserted as pending/member until an admin approves them.
