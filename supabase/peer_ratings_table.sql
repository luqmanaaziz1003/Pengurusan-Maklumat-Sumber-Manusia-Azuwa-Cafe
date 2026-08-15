-- Run this in the Supabase dashboard → SQL Editor.
-- public.peer_ratings holds coworker ratings from "Nilai Rakan Sekerja".
-- One rating per (rater, ratee) pair — re-rating updates the existing row.

create table if not exists public.peer_ratings (
  id         uuid        primary key default gen_random_uuid(),
  rater_id   uuid        not null references auth.users (id) on delete cascade,
  ratee_id   uuid        not null references auth.users (id) on delete cascade,
  rating     integer     not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rater_id, ratee_id)
);

create index if not exists peer_ratings_ratee_idx on public.peer_ratings (ratee_id);

-- Rating coworkers requires reading the staff roster, so let any signed-in user
-- view profiles. (Owner/manager select policies remain in place and are additive.)
drop policy if exists "Profiles viewable by authenticated" on public.profiles;
create policy "Profiles viewable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Row Level Security: a rater manages their own ratings; managers can read all
-- (for a future "best worker" view). Relies on public.is_manager().
alter table public.peer_ratings enable row level security;

drop policy if exists "Ratings selectable by rater"    on public.peer_ratings;
drop policy if exists "Ratings insertable by rater"    on public.peer_ratings;
drop policy if exists "Ratings updatable by rater"     on public.peer_ratings;
drop policy if exists "Ratings viewable by managers"   on public.peer_ratings;

create policy "Ratings selectable by rater"
  on public.peer_ratings for select
  using (auth.uid() = rater_id);

create policy "Ratings insertable by rater"
  on public.peer_ratings for insert
  with check (auth.uid() = rater_id);

create policy "Ratings updatable by rater"
  on public.peer_ratings for update
  using (auth.uid() = rater_id)
  with check (auth.uid() = rater_id);

create policy "Ratings viewable by managers"
  on public.peer_ratings for select
  using (public.is_manager());

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists peer_ratings_set_updated_at on public.peer_ratings;
create trigger peer_ratings_set_updated_at
  before update on public.peer_ratings
  for each row execute function public.set_updated_at();
