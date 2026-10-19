-- Replace the per-member routine penalty switch with one family-wide switch.
-- family_settings key 'routine_penalty' = {"enabled": bool}; a missing or
-- unreadable setting means the penalty is on (the original behaviour). When
-- off, both routine penalty RPCs return an exemption before any deduction.

create or replace function public.routine_penalty_enabled(p_family_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_value text;
begin
  select value into v_value
  from public.family_settings
  where family_id = p_family_id
    and key = 'routine_penalty'
  limit 1;

  if v_value is null then return true; end if;
  return coalesce((v_value::jsonb->>'enabled')::boolean, true);
exception when others then
  return true;
end;
$$;

revoke all on function public.routine_penalty_enabled(uuid) from public, anon, authenticated;

create or replace function public.admin_set_routine_penalty(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_enabled boolean := coalesce(p_enabled, true);
begin
  insert into public.family_settings (key, value, updated_at, family_id)
  values ('routine_penalty', jsonb_build_object('enabled', v_enabled)::text, now(), v_family_id)
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  return jsonb_build_object('enabled', v_enabled);
end;
$$;

revoke all on function public.admin_set_routine_penalty(boolean) from public, anon;
grant execute on function public.admin_set_routine_penalty(boolean) to authenticated;

-- --------------------------------------------------------------------------
-- Penalty loops without the per-member exemption (identical to the live
-- definitions before 20261018120000).
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

create or replace function public.apply_evening_routine_penalties_before_sale_exemption(
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
  if v_now < p_day_start + interval '22 hours' then
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
      and tc.completed_at < p_day_start + interval '22 hours'
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

-- --------------------------------------------------------------------------
-- Public wrappers: family switch first, then vacation mode, then the
-- automatic weekend/holiday sale exemption.
-- --------------------------------------------------------------------------

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

  if not public.routine_penalty_enabled(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'disabled'
    );
  end if;

  if public.penalty_pause_active(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'vacation'
    );
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

create or replace function public.apply_evening_routine_penalties(
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
  if v_now < p_day_start + interval '22 hours' then
    raise exception 'Evening routine deadline has not passed';
  end if;
  if v_now >= p_day_start + interval '1 day' then
    raise exception 'Evening routine penalty can only be checked on the same local day';
  end if;

  if not public.routine_penalty_enabled(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'disabled'
    );
  end if;

  if public.penalty_pause_active(v_family_id) then
    return jsonb_build_object(
      'checked', true,
      'penaltyDate', p_penalty_date,
      'penalties', '[]'::jsonb,
      'exempt', true,
      'exemptionReason', 'vacation'
    );
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

drop function if exists public.admin_set_member_routine_penalty(text, boolean);
drop function if exists public.routine_penalty_exempt(uuid, text);
delete from public.family_settings where key = 'routine_penalty_exempt_members';

notify pgrst, 'reload schema';
