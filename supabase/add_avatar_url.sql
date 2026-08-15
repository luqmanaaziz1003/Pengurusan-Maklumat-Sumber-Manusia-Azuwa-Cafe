-- Run this in the Supabase dashboard → SQL Editor.
-- Adds an optional avatar_url to profiles so the staff list (Senarai Pekerja)
-- can show a photo when one is available; otherwise it falls back to initials.
-- Safe to run multiple times.

alter table public.profiles add column if not exists avatar_url text;
