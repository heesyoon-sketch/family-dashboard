-- Migration 086: Persist Shield Wall state per family and member.
--
-- Shield state used to live only in browser localStorage. That made it easy
-- to lose equipped/unlocked shields on logout, browser cleanup, or a second
-- device. This table keeps the same state server-side, scoped by family_id
-- and user_id so multiple families can safely have independent dashboards and
-- shield walls.

create table if not exists public.achievement_states (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  unlocked_at_by_achievement_id jsonb not null default '{}'::jsonb,
  awarded_achievement_ids jsonb not null default '[]'::jsonb,
  unlocked_visual_style_ids jsonb not null default '[]'::jsonb,
  pinned_achievement_ids jsonb not null default '[]'::jsonb,
  equipped_insignia_ids jsonb not null default '[]'::jsonb,
  quest_claims jsonb not null default '{}'::jsonb,
  unlock_baseline_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index if not exists idx_achievement_states_user_id
  on public.achievement_states (user_id);

create or replace function public.touch_achievement_states_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_achievement_states_updated_at on public.achievement_states;
create trigger trg_achievement_states_updated_at
before update on public.achievement_states
for each row
execute function public.touch_achievement_states_updated_at();

alter table public.achievement_states enable row level security;

drop policy if exists achievement_states_family_select on public.achievement_states;
create policy achievement_states_family_select on public.achievement_states
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists achievement_states_family_insert on public.achievement_states;
create policy achievement_states_family_insert on public.achievement_states
  for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1
      from public.users u
      where u.id = achievement_states.user_id
        and u.family_id = achievement_states.family_id
    )
  );

drop policy if exists achievement_states_family_update on public.achievement_states;
create policy achievement_states_family_update on public.achievement_states
  for update to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1
      from public.users u
      where u.id = achievement_states.user_id
        and u.family_id = achievement_states.family_id
    )
  );

notify pgrst, 'reload schema';
