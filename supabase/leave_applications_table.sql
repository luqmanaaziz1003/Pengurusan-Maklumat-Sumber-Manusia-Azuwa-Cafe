-- Run this in the Supabase dashboard → SQL Editor.
-- public.leave_applications holds leave requests submitted from "Mohon Cuti".
-- One row per request, keyed to the requesting user.

create table if not exists public.leave_applications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  start_date date        not null,
  end_date   date        not null,
  reason     text,
  days       integer,     -- deductible days for the range (Fridays excluded)
  status     text        not null default 'pending',  -- pending | approved | rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_applications_user_id_idx
  on public.leave_applications (user_id);

-- Helper: is the current user a manager (pengurus/admin)? SECURITY DEFINER so
-- it reads profiles bypassing RLS — this avoids recursion when profiles' own
-- policies reference it, and lets managers be recognised across tables.
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('pengurus', 'admin')
  );
$$;

-- Logged-in users must be able to call is_manager() during policy evaluation.
-- Without this, every profiles/leave read that references it errors out.
grant execute on function public.is_manager() to authenticated, anon;

-- Managers need to read every staff member's profile (to show applicant names
-- on the approval screen). Owners keep access via the policy in profiles_table.sql.
drop policy if exists "Profiles viewable by managers" on public.profiles;
create policy "Profiles viewable by managers"
  on public.profiles for select
  using (public.is_manager());

-- Row Level Security: owners manage their own requests; managers can view and
-- act on all of them.
alter table public.leave_applications enable row level security;

drop policy if exists "Leave viewable by owner"    on public.leave_applications;
drop policy if exists "Leave insertable by owner"  on public.leave_applications;
drop policy if exists "Leave updatable by owner"   on public.leave_applications;
drop policy if exists "Leave viewable by managers" on public.leave_applications;
drop policy if exists "Leave updatable by managers" on public.leave_applications;

create policy "Leave viewable by owner"
  on public.leave_applications for select
  using (auth.uid() = user_id);

create policy "Leave insertable by owner"
  on public.leave_applications for insert
  with check (auth.uid() = user_id);

create policy "Leave updatable by owner"
  on public.leave_applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Leave viewable by managers"
  on public.leave_applications for select
  using (public.is_manager());

create policy "Leave updatable by managers"
  on public.leave_applications for update
  using (public.is_manager())
  with check (public.is_manager());

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leave_applications_set_updated_at on public.leave_applications;
create trigger leave_applications_set_updated_at
  before update on public.leave_applications
  for each row execute function public.set_updated_at();
