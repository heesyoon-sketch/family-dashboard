-- Per-member on/off switch for the 50-point morning/evening routine penalty.
-- Stored as family_settings key 'routine_penalty_exempt_members' with value
-- {"userIds": [...]}: listed members are never deducted. Absent setting means
-- everyone is subject to the penalty (the previous behaviour). users.id is
-- text, so member ids are text throughout.

create or replace function public.routine_penalty_exempt(p_family_id uuid, p_user_id text)
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
    and key = 'routine_penalty_exempt_members'
  limit 1;

  if v_value is null then return false; end if;
  return coalesce(v_value::jsonb->'userIds', '[]'::jsonb) ? p_user_id;
exception when others then
  return false;
end;
$$;

revoke all on function public.routine_penalty_exempt(uuid, text) from public, anon, authenticated;

create or replace function public.admin_set_member_routine_penalty(p_user_id text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_current jsonb;
  v_next jsonb;
begin
  if not exists (
    select 1 from public.users
    where id = p_user_id and family_id = v_family_id and deleted_at is null
  ) then
    raise exception 'Member not found';
  end if;

  select coalesce(value::jsonb->'userIds', '[]'::jsonb) into v_current
  from public.family_settings
  where family_id = v_family_id and key = 'routine_penalty_exempt_members'
  for update;
  v_current := coalesce(v_current, '[]'::jsonb);

  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_next
  from (
    select distinct e.id
    from jsonb_array_elements_text(v_current) as e(id)
    where e.id <> p_user_id
    union
    select p_user_id where not coalesce(p_enabled, true)
  ) ids;

  insert into public.family_settings (key, value, updated_at, family_id)
  values ('routine_penalty_exempt_members', jsonb_build_object('userIds', v_next)::text, now(), v_family_id)
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  return jsonb_build_object('userIds', v_next);
end;
$$;

revoke all on function public.admin_set_member_routine_penalty(text, boolean) from public, anon;
grant execute on function public.admin_set_member_routine_penalty(text, boolean) to authenticated;

-- --------------------------------------------------------------------------
-- Re-create both penalty loops with the per-member exemption check. Bodies
-- are otherwise identical to the live definitions (noon / 22:00 deadlines).
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
    if public.routine_penalty_exempt(v_family_id, v_member.id) then continue; end if;

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
    if public.routine_penalty_exempt(v_family_id, v_member.id) then continue; end if;

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

notify pgrst, 'reload schema';
