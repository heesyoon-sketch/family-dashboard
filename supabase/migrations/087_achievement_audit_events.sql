-- Migration 087: append-only audit ledger for Shield Wall changes.
--
-- This records why achievement state changed without mixing audit history into
-- the mutable achievement_states row. Normal authenticated clients can read
-- same-family events but cannot update or delete them. Inserts go through the
-- validated security-definer RPC below so family/user checks stay centralized.

create table if not exists public.achievement_audit_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  achievement_id text not null,
  event_type text not null check (
    event_type in ('UNLOCKED', 'BONUS_AWARDED', 'REVOKED', 'BONUS_REFUNDED')
  ),
  points_delta integer not null default 0,
  task_completion_id text null,
  revocation_window_start timestamptz null,
  revocation_window_end timestamptz null,
  occurred_at timestamptz not null default now(),
  actor_auth_user_id uuid null,
  source text not null default 'achievement_engine',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_achievement_audit_events_family_occurred
  on public.achievement_audit_events (family_id, occurred_at desc);

create index if not exists idx_achievement_audit_events_family_user_occurred
  on public.achievement_audit_events (family_id, user_id, occurred_at desc);

create index if not exists idx_achievement_audit_events_family_achievement_occurred
  on public.achievement_audit_events (family_id, achievement_id, occurred_at desc);

create index if not exists idx_achievement_audit_events_task_completion
  on public.achievement_audit_events (task_completion_id)
  where task_completion_id is not null;

alter table public.achievement_audit_events enable row level security;

drop policy if exists achievement_audit_events_family_select on public.achievement_audit_events;
create policy achievement_audit_events_family_select on public.achievement_audit_events
  for select to authenticated
  using (public.is_family_member(family_id));

create or replace function public.record_achievement_audit_events(
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event jsonb;
  v_family_id uuid;
  v_user_id text;
  v_achievement_id text;
  v_event_type text;
  v_points_delta integer;
  v_task_completion_id text;
  v_revocation_window_start timestamptz;
  v_revocation_window_end timestamptz;
  v_occurred_at timestamptz;
  v_source text;
  v_detail jsonb;
  v_inserted integer := 0;
begin
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'p_events must be a jsonb array';
  end if;

  for v_event in
    select value from jsonb_array_elements(p_events)
  loop
    v_family_id := nullif(v_event->>'family_id', '')::uuid;
    v_user_id := nullif(v_event->>'user_id', '');
    v_achievement_id := nullif(v_event->>'achievement_id', '');
    v_event_type := nullif(v_event->>'event_type', '');
    v_points_delta := coalesce(nullif(v_event->>'points_delta', '')::integer, 0);
    v_task_completion_id := nullif(v_event->>'task_completion_id', '');
    v_revocation_window_start := nullif(v_event->>'revocation_window_start', '')::timestamptz;
    v_revocation_window_end := nullif(v_event->>'revocation_window_end', '')::timestamptz;
    v_occurred_at := coalesce(nullif(v_event->>'occurred_at', '')::timestamptz, now());
    v_source := coalesce(nullif(v_event->>'source', ''), 'achievement_engine');
    v_detail := coalesce(v_event->'detail', '{}'::jsonb);

    if v_family_id is null or v_user_id is null or v_achievement_id is null or v_event_type is null then
      raise exception 'audit event requires family_id, user_id, achievement_id, and event_type';
    end if;

    if not public.is_family_member(v_family_id) then
      raise exception 'not allowed';
    end if;

    if not exists (
      select 1
      from public.users u
      where u.id = v_user_id
        and u.family_id = v_family_id
    ) then
      raise exception 'audit event user is not in family';
    end if;

    insert into public.achievement_audit_events (
      family_id,
      user_id,
      achievement_id,
      event_type,
      points_delta,
      task_completion_id,
      revocation_window_start,
      revocation_window_end,
      occurred_at,
      actor_auth_user_id,
      source,
      detail
    )
    values (
      v_family_id,
      v_user_id,
      v_achievement_id,
      v_event_type,
      v_points_delta,
      v_task_completion_id,
      v_revocation_window_start,
      v_revocation_window_end,
      v_occurred_at,
      auth.uid(),
      v_source,
      v_detail
    );

    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.record_achievement_audit_events(jsonb) to authenticated;

notify pgrst, 'reload schema';
