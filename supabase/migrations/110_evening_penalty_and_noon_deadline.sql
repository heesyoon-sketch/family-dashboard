-- Migration 110: relax the morning routine deadline to noon (matching the
-- normal morning/afternoon switch) and generalize the point penalty to every
-- family member, plus add a matching evening routine penalty.
--
-- * The 09:00 hard lock on child task taps is removed. Morning tasks now stay
--   actionable for everyone until the normal noon switch, same as adults
--   always had. Only the 21:00 child evening lock is unchanged.
-- * The morning routine penalty (50 spendable points) now fires for every
--   family member -- not children only -- and is checked at noon instead of
--   09:00.
-- * A new evening routine penalty (also 50 spendable points, also every
--   family member) fires at 21:00 if the evening routine was not fully
--   completed, mirroring the morning penalty and its automatic-sale-day
--   exemption.

-- --------------------------------------------------------------------------
-- 1. Drop the 09:00 child-only morning lock from the completion/undo RPCs.
--    The 21:00 evening lock (and its automatic-sale-day exemption) is kept.
-- --------------------------------------------------------------------------

create or replace function public.process_task_completion_atomic(
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
  v_sale_context jsonb;
  v_sale_day boolean := false;
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

  if v_role = 'CHILD' and p_time_window = 'evening' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day
    and p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours'
  then
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

create or replace function public.process_task_undo_atomic(
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
  v_sale_context jsonb;
  v_sale_day boolean := false;
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

  if v_role = 'CHILD' and p_time_window = 'evening' then
    v_sale_context := public.routine_automatic_sale_context_at(v_family_id, p_now);
    v_sale_day := coalesce((v_sale_context->>'active')::boolean, false);
  end if;

  if v_role = 'CHILD' and not v_sale_day
    and p_time_window = 'evening' and p_now >= p_day_start + interval '21 hours'
  then
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

-- --------------------------------------------------------------------------
-- 2. Generalize the morning penalty: deadline moves from 09:00 to 12:00 and
--    every family member is checked, not only children.
-- --------------------------------------------------------------------------

create or replace function public.apply_morning_routine_penalties_before_sale_exemption(
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
  v_member record;
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
  if v_now < p_day_start + interval '12 hours' then
    raise exception 'Morning routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Morning routine penalty can only be checked on the same local day';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'morning-routine-penalty:' || v_family_id::text || ':' || p_penalty_date::text,
    0
  ));

  for v_member in
    select u.id
    from public.users u
    where u.family_id = v_family_id
      and u.deleted_at is null
    order by u.id
  loop
    select count(*)::integer into v_due
    from public.tasks t
    where t.user_id = v_member.id
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
      and tc.user_id = v_member.id
      and tc.completed_at >= p_day_start
      and tc.completed_at < p_day_start + interval '12 hours'
    where t.user_id = v_member.id
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
      v_family_id, v_member.id, p_penalty_date, p_day_start, 50, 0, v_now
    )
    on conflict (user_id, penalty_date) do nothing
    returning id into v_penalty_id;

    if v_penalty_id is null then continue; end if;

    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values (v_member.id, 1, 0, 0, v_now)
    on conflict (user_id) do nothing;

    select greatest(coalesce(l.spendable_balance, 0), 0)
      into v_balance
    from public.levels l
    where l.user_id = v_member.id
    for update;

    v_deducted := least(50, v_balance);

    update public.levels
    set spendable_balance = v_balance - v_deducted,
        updated_at = v_now
    where user_id = v_member.id;

    update public.morning_routine_penalties
    set points_deducted = v_deducted
    where id = v_penalty_id;

    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    ) values (
      v_family_id,
      v_member.id::uuid,
      'SYSTEM_MESSAGE',
      -v_deducted,
      'MORNING_ROUTINE_PENALTY:' || p_penalty_date::text,
      v_now
    );

    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'userId', v_member.id,
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

revoke all on function public.apply_morning_routine_penalties_before_sale_exemption(
  timestamptz, text, date
) from public, anon, authenticated;

create or replace function public.apply_morning_routine_penalties(
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
  v_sale_context jsonb;
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
  if v_now < p_day_start + interval '12 hours' then
    raise exception 'Morning routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Morning routine penalty can only be checked on the same local day';
  end if;

  -- Use the same server-authoritative sale clock and family timezone as
  -- checkout. A manual item sale does not create an exemption; only an active
  -- configured weekend/public-holiday automatic sale does.
  v_sale_context := public.automatic_reward_sale_context(v_family_id, v_now);
  if coalesce((v_sale_context->>'active')::boolean, false)
    and v_sale_context->>'localDate' = p_penalty_date::text
  then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', v_sale_context->>'reason'
    );
  end if;

  return public.apply_morning_routine_penalties_before_sale_exemption(
    p_day_start, p_day_key, p_penalty_date
  );
end;
$$;

revoke all on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) from public, anon;
grant execute on function public.apply_morning_routine_penalties(
  timestamptz, text, date
) to authenticated;

-- --------------------------------------------------------------------------
-- 3. New evening routine penalty: same 50-point mechanics, checked at 21:00,
--    every family member, same automatic-sale-day exemption as the morning.
-- --------------------------------------------------------------------------

create table public.evening_routine_penalties (
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

create index evening_routine_penalties_family_date_idx
  on public.evening_routine_penalties (family_id, penalty_date desc);

alter table public.evening_routine_penalties enable row level security;

create policy "evening_routine_penalties_family_select"
  on public.evening_routine_penalties
  for select to authenticated
  using (family_id = (select public.get_my_family_id()));

grant select on public.evening_routine_penalties to authenticated;

create function public.apply_evening_routine_penalties_before_sale_exemption(
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
  v_member record;
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
  if v_now < p_day_start + interval '21 hours' then
    raise exception 'Evening routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Evening routine penalty can only be checked on the same local day';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'evening-routine-penalty:' || v_family_id::text || ':' || p_penalty_date::text,
    0
  ));

  for v_member in
    select u.id
    from public.users u
    where u.family_id = v_family_id
      and u.deleted_at is null
    order by u.id
  loop
    select count(*)::integer into v_due
    from public.tasks t
    where t.user_id = v_member.id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening'
      );

    if v_due = 0 then continue; end if;

    select count(distinct t.id)::integer into v_done
    from public.tasks t
    join public.task_completions tc
      on tc.task_id = t.id
      and tc.user_id = v_member.id
      and tc.completed_at >= p_day_start + interval '12 hours'
      and tc.completed_at < p_day_start + interval '21 hours'
    where t.user_id = v_member.id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening'
      );

    if v_done = v_due then continue; end if;

    v_penalty_id := null;
    insert into public.evening_routine_penalties (
      family_id, user_id, penalty_date, day_started_at, penalty_points, points_deducted, created_at
    ) values (
      v_family_id, v_member.id, p_penalty_date, p_day_start, 50, 0, v_now
    )
    on conflict (user_id, penalty_date) do nothing
    returning id into v_penalty_id;

    if v_penalty_id is null then continue; end if;

    insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
    values (v_member.id, 1, 0, 0, v_now)
    on conflict (user_id) do nothing;

    select greatest(coalesce(l.spendable_balance, 0), 0)
      into v_balance
    from public.levels l
    where l.user_id = v_member.id
    for update;

    v_deducted := least(50, v_balance);

    update public.levels
    set spendable_balance = v_balance - v_deducted,
        updated_at = v_now
    where user_id = v_member.id;

    update public.evening_routine_penalties
    set points_deducted = v_deducted
    where id = v_penalty_id;

    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    ) values (
      v_family_id,
      v_member.id::uuid,
      'SYSTEM_MESSAGE',
      -v_deducted,
      'EVENING_ROUTINE_PENALTY:' || p_penalty_date::text,
      v_now
    );

    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'userId', v_member.id,
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

revoke all on function public.apply_evening_routine_penalties_before_sale_exemption(
  timestamptz, text, date
) from public, anon, authenticated;

create function public.apply_evening_routine_penalties(
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
  v_sale_context jsonb;
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
  if v_now < p_day_start + interval '21 hours' then
    raise exception 'Evening routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Evening routine penalty can only be checked on the same local day';
  end if;

  -- Same server-authoritative sale clock and exemption rule as the morning
  -- penalty: an active automatic weekend/holiday sale skips the deduction.
  v_sale_context := public.automatic_reward_sale_context(v_family_id, v_now);
  if coalesce((v_sale_context->>'active')::boolean, false)
    and v_sale_context->>'localDate' = p_penalty_date::text
  then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', v_sale_context->>'reason'
    );
  end if;

  return public.apply_evening_routine_penalties_before_sale_exemption(
    p_day_start, p_day_key, p_penalty_date
  );
end;
$$;

revoke all on function public.apply_evening_routine_penalties(
  timestamptz, text, date
) from public, anon;
grant execute on function public.apply_evening_routine_penalties(
  timestamptz, text, date
) to authenticated;

notify pgrst, 'reload schema';
