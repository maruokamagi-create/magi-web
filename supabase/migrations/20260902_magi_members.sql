create table if not exists public.magi_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  provider text not null default 'email',
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  role text not null default 'member' check (role in ('member', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

alter table public.magi_members enable row level security;

create or replace function public.is_magi_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.magi_members
    where user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

revoke all on function public.is_magi_admin() from public;
grant execute on function public.is_magi_admin() to authenticated;

drop policy if exists "members can read own profile" on public.magi_members;
create policy "members can read own profile"
on public.magi_members for select
to authenticated
using (user_id = auth.uid() or public.is_magi_admin());

drop policy if exists "admins can update member profiles" on public.magi_members;
create policy "admins can update member profiles"
on public.magi_members for update
to authenticated
using (public.is_magi_admin())
with check (public.is_magi_admin());

create or replace function public.handle_new_magi_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.magi_members (user_id, email, display_name, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_magi_member on auth.users;
create trigger on_auth_user_created_create_magi_member
after insert on auth.users
for each row execute procedure public.handle_new_magi_user();

revoke all on table public.magi_members from anon;
grant select, update on table public.magi_members to authenticated;

comment on table public.magi_members is
  'MAGI-WEB access registry. Identity is auth.users.id; display names are never identity keys.';
