-- Run this in the Supabase dashboard → SQL Editor.
-- Adds the weekly salary field, editable by managers from "Senarai Pekerja".
-- Safe to run multiple times.

alter table public.profiles add column if not exists weekly_salary numeric(10, 2);

-- Managers (pengurus/admin) need to update other staff members' profiles
-- (role, weekly salary) from the staff roster's detail panel. Relies on
-- public.is_manager() — defined in leave_applications_table.sql, run that
-- file first.
drop policy if exists "Profiles updatable by managers" on public.profiles;
create policy "Profiles updatable by managers"
  on public.profiles for update
  using (public.is_manager())
  with check (public.is_manager());
