-- Stats / Shield Wall redesign foundations. Additive only: no existing rows,
-- policies, or game mechanics change.
--
-- 1. tasks.created_at — lets Stats know when a habit started being eligible.
--    Existing rows receive the migration timestamp; the client treats a
--    task's first recorded completion as earlier evidence when present, so
--    historical completion rates are never computed from before a habit
--    plausibly existed.
-- 2. family_mission_weeks — one optional cooperative mission per family per
--    week. Rules (participants and their eligible habit slots) are frozen in
--    `rules` when the week's row is created, so later habit edits never
--    change an active or finished mission. Missions grant no points.
--
-- Rollback (safe, loses only mission history):
--   drop table if exists public.family_mission_weeks;
--   alter table public.tasks drop column if exists created_at;

alter table public.tasks
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.family_mission_weeks (
  family_id    uuid not null references public.families(id) on delete cascade,
  week_start   date not null,
  mission_id   text not null check (mission_id in ('all-together', 'strong-week', 'comeback-crew', 'family-harmony')),
  rules        jsonb not null,
  status       text not null default 'active' check (status in ('active', 'completed', 'missed')),
  result       jsonb,
  created_at   timestamptz not null default now(),
  finalized_at timestamptz,
  primary key (family_id, week_start),
  check (extract(isodow from week_start) = 1)
);

alter table public.family_mission_weeks enable row level security;
grant select, insert, update on public.family_mission_weeks to authenticated;

create policy family_mission_weeks_read on public.family_mission_weeks
  for select to authenticated
  using (public.is_family_member(family_id));

-- A week starts as 'active'; any device in the family may create it once.
create policy family_mission_weeks_start on public.family_mission_weeks
  for insert to authenticated
  with check (public.is_family_member(family_id) and status = 'active' and finalized_at is null);

-- Only an active week can be finalized, and only once.
create policy family_mission_weeks_finalize on public.family_mission_weeks
  for update to authenticated
  using (public.is_family_member(family_id) and status = 'active')
  with check (public.is_family_member(family_id) and status in ('completed', 'missed') and finalized_at is not null);

-- Rules are frozen: an update may change only the outcome columns.
create or replace function public.family_mission_weeks_freeze_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.family_id <> old.family_id
     or new.week_start <> old.week_start
     or new.mission_id <> old.mission_id
     or new.rules <> old.rules
     or new.created_at <> old.created_at then
    raise exception 'Mission rules are frozen once the week starts';
  end if;
  return new;
end;
$$;

create trigger family_mission_weeks_freeze_rules
  before update on public.family_mission_weeks
  for each row execute function public.family_mission_weeks_freeze_rules();

notify pgrst, 'reload schema';
