-- Run this in the Supabase dashboard → SQL Editor.
-- Powers QR-code attendance: a manager picks a date and clicks "Jana Kod QR"
-- in the QR panel (top-right icon), which mints a fresh token every 15
-- seconds for that date; staff open the same icon to scan it with their
-- camera, recording one attendance row per person per day.
-- Requires supabase/leave_applications_table.sql (for public.is_manager()) to
-- have been run first.

create table if not exists public.attendance_qr_sessions (
  id              uuid        primary key default gen_random_uuid(),
  token           uuid        not null default gen_random_uuid(),
  attendance_date date        not null default current_date,
  created_by      uuid        not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '15 seconds')
);

create index if not exists attendance_qr_sessions_token_idx
  on public.attendance_qr_sessions (token);

alter table public.attendance_qr_sessions enable row level security;

drop policy if exists "QR sessions insertable by managers" on public.attendance_qr_sessions;
drop policy if exists "QR sessions viewable by managers"   on public.attendance_qr_sessions;

create policy "QR sessions insertable by managers"
  on public.attendance_qr_sessions for insert
  with check (public.is_manager() and auth.uid() = created_by);

create policy "QR sessions viewable by managers"
  on public.attendance_qr_sessions for select
  using (public.is_manager());

-- One row per person per day. attendance_date is stamped from the QR
-- session the staff member scanned (the date the manager chose when
-- generating it), not necessarily the calendar day they scanned on.
-- A row can also be created directly by a manager (method = 'manual') for
-- staff who forgot their phone — see "QR Kehadiran".
create table if not exists public.attendance_records (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  attendance_date date        not null default current_date,
  scanned_at      timestamptz not null default now(),
  method          text        not null default 'scan', -- scan | manual
  marked_by       uuid        references auth.users (id) on delete set null,
  unique (user_id, attendance_date)
);

alter table public.attendance_records add column if not exists method text not null default 'scan';
alter table public.attendance_records add column if not exists marked_by uuid references auth.users (id) on delete set null;
alter table public.attendance_records drop constraint if exists attendance_records_method_check;
alter table public.attendance_records add constraint attendance_records_method_check
  check (method in ('scan', 'manual'));

create index if not exists attendance_records_user_id_idx
  on public.attendance_records (user_id);
create index if not exists attendance_records_date_idx
  on public.attendance_records (attendance_date);

alter table public.attendance_records enable row level security;

drop policy if exists "Attendance insertable by owner"    on public.attendance_records;
drop policy if exists "Attendance viewable by owner"      on public.attendance_records;
drop policy if exists "Attendance viewable by managers"   on public.attendance_records;
drop policy if exists "Attendance insertable by managers" on public.attendance_records;
drop policy if exists "Attendance updatable by managers"  on public.attendance_records;
drop policy if exists "Attendance deletable by managers"  on public.attendance_records;

create policy "Attendance insertable by owner"
  on public.attendance_records for insert
  with check (auth.uid() = user_id);

create policy "Attendance viewable by owner"
  on public.attendance_records for select
  using (auth.uid() = user_id);

create policy "Attendance viewable by managers"
  on public.attendance_records for select
  using (public.is_manager());

-- Roll-call: managers can mark a staff member present (forgot their phone,
-- etc.) or undo a mistaken mark, for anyone.
create policy "Attendance insertable by managers"
  on public.attendance_records for insert
  with check (public.is_manager());

create policy "Attendance updatable by managers"
  on public.attendance_records for update
  using (public.is_manager())
  with check (public.is_manager());

create policy "Attendance deletable by managers"
  on public.attendance_records for delete
  using (public.is_manager());

-- Staff only ever send the scanned token, not a session id — this looks it
-- up and rejects expired/unknown tokens server-side, so a stale or guessed
-- QR value can't be replayed into an attendance row. The attendance date is
-- taken from the session (the date the manager selected), not today's date.
create or replace function public.check_in_with_qr_token(scanned_token uuid)
returns public.attendance_records as $$
declare
  session_row public.attendance_qr_sessions;
  result_row  public.attendance_records;
begin
  select * into session_row
  from public.attendance_qr_sessions
  where token = scanned_token
  order by created_at desc
  limit 1;

  if session_row.id is null then
    raise exception 'Kod QR tidak sah.';
  end if;

  if session_row.expires_at < now() then
    raise exception 'Kod QR telah tamat tempoh. Sila imbas kod terkini.';
  end if;

  insert into public.attendance_records (user_id, attendance_date)
  values (auth.uid(), session_row.attendance_date)
  on conflict (user_id, attendance_date) do nothing
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Kehadiran anda untuk tarikh ini telah direkodkan.';
  end if;

  return result_row;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.check_in_with_qr_token(uuid) to authenticated;
