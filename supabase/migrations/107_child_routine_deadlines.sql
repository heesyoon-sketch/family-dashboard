-- Migration 107: school-day routine deadlines for child profiles.
--
-- * The dashboard changes from morning to afternoon/evening at 12:00.
-- * Child-owned morning tasks can be changed only before 09:00.
-- * Child-owned afternoon/evening tasks can be changed only from 12:00-20:59.
-- * An incomplete scheduled morning routine deducts up to 50 spendable points
--   once per child/day. Lifetime XP is intentionally preserved.

create or replace function public.task_completion_window_start(
  p_day_start timestamptz,
  p_task_window text,
  p_current_window text
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when public.task_effective_window(p_task_window, p_current_window) = 'morning' then p_day_start
    else p_day_start + interval '12 hours'
  end;
$$;

create or replace function public.task_completion_window_end(
  p_day_start timestamptz,
  p_task_window text,
  p_current_window text
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when public.task_effective_window(p_task_window, p_current_window) = 'morning'
      then p_day_start + interval '12 hours'
    else p_day_start + interval '1 day'
  end;
$$;

-- Keep the mature completion/undo implementations intact and wrap them with
-- server-side time enforcement. The inner functions are not callable through
-- PostgREST; only the guarded public names retain authenticated access.
alter function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) rename to process_task_completion_atomic_before_routine_deadlines;

revoke all on function public.process_task_completion_atomic_before_routine_deadlines(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) from public, anon, authenticated;

create function public.process_task_completion_atomic(
  p_user_id text,
  p_task_id text,
  p_partial boolean,
  p_day_start timestamptz,
  p_day_key text,
  p_time_window text,
  p_now timestamptz,
  p_bonus_percent numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_role text;
  v_expected_window text;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' and (
    (p_time_window = 'morning' and p_now >= p_day_start + interval '9 hours')
    or (p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours')
  ) then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  return public.process_task_completion_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_partial, p_day_start, p_day_key,
    p_time_window, p_now, p_bonus_percent
  );
end;
$$;

revoke all on function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) from public, anon;
grant execute on function public.process_task_completion_atomic(
  text, text, boolean, timestamptz, text, text, timestamptz, numeric
) to authenticated;

alter function public.process_task_undo_atomic(
  text, text, timestamptz, text, text, timestamptz
) rename to process_task_undo_atomic_before_routine_deadlines;

revoke all on function public.process_task_undo_atomic_before_routine_deadlines(
  text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;

create function public.process_task_undo_atomic(
  p_user_id text,
  p_task_id text,
  p_day_start timestamptz,
  p_day_key text,
  p_time_window text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_role text;
  v_expected_window text;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_now is null or p_time_window not in ('morning', 'evening') then
    raise exception 'Invalid routine time';
  end if;
  if p_now < p_day_start or p_now >= p_day_start + interval '1 day' then
    raise exception 'Task action must belong to the current routine day';
  end if;

  select u.role into v_role
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
    and t.deleted_at is null;

  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_expected_window := case
    when p_now < p_day_start + interval '12 hours' then 'morning'
    else 'evening'
  end;
  if p_time_window <> v_expected_window then
    raise exception 'Task is not available in this routine window';
  end if;

  if v_role = 'CHILD' and (
    (p_time_window = 'morning' and p_now >= p_day_start + interval '9 hours')
    or (p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours')
  ) then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  return public.process_task_undo_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_day_start, p_day_key, p_time_window, p_now
  );
end;
$$;

revoke all on function public.process_task_undo_atomic(
  text, text, timestamptz, text, text, timestamptz
) from public, anon;
grant execute on function public.process_task_undo_atomic(
  text, text, timestamptz, text, text, timestamptz
) to authenticated;

create table public.morning_routine_penalties (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families(id) on delete cascade,
  user_id            text not null references public.users(id) on delete cascade,
  penalty_date       date not null,
  day_started_at     timestamptz not null,
  penalty_points     integer not null default 50 check (penalty_points = 50),
  points_deducted    integer not null default 0 check (points_deducted between 0 and 50),
  created_at         timestamptz not null default now(),
  unique (user_id, penalty_date),
  unique (user_id, day_started_at)
);

create index morning_routine_penalties_family_date_idx
  on public.morning_routine_penalties (family_id, penalty_date desc);

alter table public.morning_routine_penalties enable row level security;

create policy "morning_routine_penalties_family_select"
  on public.morning_routine_penalties
  for select to authenticated
  using (family_id = (select public.get_my_family_id()));

grant select on public.morning_routine_penalties to authenticated;

create function public.apply_morning_routine_penalties(
  p_day_start timestamptz,
  p_day_key text,
  p_penalty_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_now timestamptz := statement_timestamp();
  v_expected_day_key text;
  v_child record;
  v_due integer;
  v_done integer;
  v_penalty_id uuid;
  v_balance integer;
  v_deducted integer;
  v_penalties jsonb := '[]'::jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_penalty_date is null then
    raise exception 'Invalid routine day';
  end if;

  v_expected_day_key := case extract(isodow from p_penalty_date)
    when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
    when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN'
  end;
  if p_day_key is distinct from v_expected_day_key then
    raise exception 'Routine weekday does not match the date';
  end if;
  if abs(p_penalty_date - p_day_start::date) > 1 then
    raise exception 'Routine date does not match its start time';
  end if;
  if v_now < p_day_start + interval '9 hours' then
    raise exception 'Morning routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Morning routine penalty can only be checked on the same local day';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'morning-routine-penalty:' || v_family_id::text || ':' || p_penalty_date::text,
    0
  ));

  for v_child in
    select u.id
    from public.users u
    where u.family_id = v_family_id
      and u.role = 'CHILD'
      and u.deleted_at is null
    order by u.id
  loop
    select count(*)::integer into v_due
    from public.tasks t
    where t.user_id = v_child.id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning'
      );

    if v_due = 0 then continue; end if;

    select count(distinct t.id)::integer into v_done
    from public.tasks t
    join public.task_completions tc
      on tc.task_id = t.id
      and tc.user_id = v_child.id
      and tc.completed_at >= p_day_start
      and tc.completed_at < p_day_start + interval '9 hours'
    where t.user_id = v_child.id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning'
      );

    if v_done = v_due then continue; end if;

    v_penalty_id := null;
    insert into public.morning_routine_penalties (
      family_id, user_id, penalty_date, day_started_at, penalty_points, points_deducted, created_at
    ) values (
      v_family_id, v_child.id, p_penalty_date, p_day_start, 50, 0, v_now
    )
    on conflict (user_id, penalty_date) do nothing
    returning id into v_penalty_id;

    if v_penalty_id is null then continue; end if;

    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values (v_child.id, 1, 0, 0, v_now)
    on conflict (user_id) do nothing;

    select greatest(coalesce(l.spendable_balance, 0), 0)
      into v_balance
    from public.levels l
    where l.user_id = v_child.id
    for update;

    v_deducted := least(50, v_balance);

    update public.levels
    set spendable_balance = v_balance - v_deducted,
        updated_at = v_now
    where user_id = v_child.id;

    update public.morning_routine_penalties
    set points_deducted = v_deducted
    where id = v_penalty_id;

    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    ) values (
      v_family_id,
      v_child.id::uuid,
      'SYSTEM_MESSAGE',
      -v_deducted,
      'MORNING_ROUTINE_PENALTY:' || p_penalty_date::text,
      v_now
    );

    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'userId', v_child.id,
      'pointsDeducted', v_deducted,
      'due', v_due,
      'done', v_done
    ));
  end loop;

  return jsonb_build_object(
    'checked', true,
    'penaltyDate', p_penalty_date,
    'penalties', v_penalties
  );
end;
$$;

revoke all on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) from public, anon;
grant execute on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) to authenticated;

notify pgrst, 'reload schema';
