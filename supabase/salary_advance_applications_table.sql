-- Run this in the Supabase dashboard → SQL Editor.
-- public.salary_advance_applications holds advance-salary requests submitted
-- from "Mohon Gaji Awal". One row per request, keyed to the requesting user.

create table if not exists public.salary_advance_applications (
  id              uuid           primary key default gen_random_uuid(),
  user_id         uuid           not null references auth.users (id) on delete cascade,
  amount          numeric(10, 2) not null,
  reason          text,
  deduction_month date,           -- month the advance is deducted from (1st of month)
  status          text           not null default 'pending', -- pending | approved | rejected
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now()
);

create index if not exists salary_advance_user_id_idx
  on public.salary_advance_applications (user_id);

-- Row Level Security: owners manage their own requests; managers (pengurus/
-- admin) can view and act on all of them. Relies on public.is_manager() —
-- defined in leave_applications_table.sql, run that file first.
alter table public.salary_advance_applications enable row level security;

drop policy if exists "Advance viewable by owner"     on public.salary_advance_applications;
drop policy if exists "Advance insertable by owner"   on public.salary_advance_applications;
drop policy if exists "Advance updatable by owner"    on public.salary_advance_applications;
drop policy if exists "Advance viewable by managers"  on public.salary_advance_applications;
drop policy if exists "Advance updatable by managers" on public.salary_advance_applications;

create policy "Advance viewable by owner"
  on public.salary_advance_applications for select
  using (auth.uid() = user_id);

create policy "Advance insertable by owner"
  on public.salary_advance_applications for insert
  with check (auth.uid() = user_id);

create policy "Advance updatable by owner"
  on public.salary_advance_applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Advance viewable by managers"
  on public.salary_advance_applications for select
  using (public.is_manager());

create policy "Advance updatable by managers"
  on public.salary_advance_applications for update
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

drop trigger if exists salary_advance_set_updated_at on public.salary_advance_applications;
create trigger salary_advance_set_updated_at
  before update on public.salary_advance_applications
  for each row execute function public.set_updated_at();
