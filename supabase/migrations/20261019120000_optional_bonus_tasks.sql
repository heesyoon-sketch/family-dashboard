-- Optional / Bonus tasks.
--
-- Every task now carries a task_type. 'required' is the existing behavior;
-- 'optional' tasks can be completed for points exactly like required ones
-- (same RPC, same once-per-window guard, same shield bonus) but are never
-- "due": they are left out of routine deadline penalties, Perfect Day /
-- weekly quest eligibility, and the Shield schedule snapshots that monthly
-- evaluation is built from. Skipping one therefore changes nothing.
--
-- Existing rows default to 'required', so history, points and Shield
-- records are untouched. A text + check (rather than a boolean) leaves room
-- for later kinds such as repeatable bonus tasks or capped bonus tasks.

alter table public.tasks
  add column if not exists task_type text not null default 'required';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_task_type_check' and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_task_type_check check (task_type in ('required', 'optional'));
  end if;
end;
$$;

-- admin_insert_task gains an optional p_task_type (default 'required') so
-- existing callers keep working. Drop the old signature first to avoid an
-- ambiguous overload.
drop function if exists public.admin_insert_task(text, text, text, text, integer, text, text[], integer, integer);

create or replace function public.admin_insert_task(
  p_user_id text,
  p_title text,
  p_icon text,
  p_difficulty text,
  p_base_points integer,
  p_recurrence text,
  p_days_of_week text[],
  p_active integer,
  p_sort_order integer,
  p_task_type text default 'required'
)
 returns tasks
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
begin
  if not exists (select 1 from public.users where id = p_user_id and family_id = v_family_id) then
    raise exception 'User is not in your family';
  end if;
  if coalesce(p_task_type, 'required') not in ('required', 'optional') then
    raise exception 'Invalid task type';
  end if;

  insert into public.tasks (
    id, user_id, title, icon, difficulty, base_points, recurrence,
    days_of_week, active, sort_order, family_id, task_type
  )
  values (
    gen_random_uuid()::text, p_user_id, trim(p_title), p_icon, p_difficulty,
    public.normalize_task_base_points(p_base_points), p_recurrence,
    p_days_of_week, p_active, p_sort_order, v_family_id,
    coalesce(p_task_type, 'required')
  )
  returning * into v_task;

  return v_task;
end;
$function$;

revoke all on function public.admin_insert_task(text, text, text, text, integer, text, text[], integer, integer, text) from public, anon;
grant execute on function public.admin_insert_task(text, text, text, text, integer, text, text[], integer, integer, text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_task(p_task_id text, p_patch jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
begin
  if p_patch ? 'task_type' and p_patch->>'task_type' not in ('required', 'optional') then
    raise exception 'Invalid task type';
  end if;

  update public.tasks
  set title = coalesce(p_patch->>'title', title),
      icon = coalesce(p_patch->>'icon', icon),
      base_points = case
        when p_patch ? 'base_points'
          then public.normalize_task_base_points((p_patch->>'base_points')::int)
        else base_points
      end,
      active = coalesce((p_patch->>'active')::int, active),
      sort_order = coalesce((p_patch->>'sort_order')::int, sort_order),
      time_window = case
        when p_patch ? 'time_window' then
          case
            when p_patch->>'time_window' in ('morning', 'evening', 'both') then p_patch->>'time_window'
            else 'evening'
          end
        else time_window
      end,
      days_of_week = case
        when p_patch ? 'days_of_week' then array(select jsonb_array_elements_text(p_patch->'days_of_week'))
        else days_of_week
      end,
      task_type = coalesce(p_patch->>'task_type', task_type)
  where id = p_task_id
    and family_id = v_family_id
  returning * into v_task;

  return v_task;
end;
$function$;

-- apply_morning_routine_penalties_before_sale_exemption: bonus tasks are never due.
CREATE OR REPLACE FUNCTION public.apply_morning_routine_penalties_before_sale_exemption(p_day_start timestamp with time zone, p_day_key text, p_penalty_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_points integer := public.routine_penalty_points(v_family_id);
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
      and t.task_type = 'required'
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
      and t.task_type = 'required'
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning'
      );

    if v_done = v_due then continue; end if;

    v_penalty_id := null;
    insert into public.morning_routine_penalties (
      family_id, user_id, penalty_date, day_started_at, penalty_points, points_deducted, created_at
    ) values (
      v_family_id, v_member.id, p_penalty_date, p_day_start, v_points, 0, v_now
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

    v_deducted := least(v_points, v_balance);

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
$function$;

-- apply_evening_routine_penalties_before_sale_exemption: bonus tasks are never due.
CREATE OR REPLACE FUNCTION public.apply_evening_routine_penalties_before_sale_exemption(p_day_start timestamp with time zone, p_day_key text, p_penalty_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_points integer := public.routine_penalty_points(v_family_id);
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
      and t.task_type = 'required'
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
      and t.task_type = 'required'
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening'
      );

    if v_done = v_due then continue; end if;

    v_penalty_id := null;
    insert into public.evening_routine_penalties (
      family_id, user_id, penalty_date, day_started_at, penalty_points, points_deducted, created_at
    ) values (
      v_family_id, v_member.id, p_penalty_date, p_day_start, v_points, 0, v_now
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

    v_deducted := least(v_points, v_balance);

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
$function$;

-- claim_perfect_day_coupon: bonus tasks are never due.
CREATE OR REPLACE FUNCTION public.claim_perfect_day_coupon(p_user_id text, p_day_start timestamp with time zone, p_day_key text, p_earned_for_day date, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_locked_user_id text;
  v_week_start date;
  v_morning_due integer;
  v_evening_due integer;
  v_morning_done integer;
  v_evening_done integer;
  v_qualifying_days integer;
  v_required_days integer;
  v_reward_slot integer;
  v_reward_kind text;
  v_awarded boolean := false;
  v_coupon public.perfect_day_coupons%rowtype;
  v_coupons jsonb := '[]'::jsonb;
  v_quest jsonb;
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_day_start is null or p_earned_for_day is null or p_now is null then
    raise exception 'Weekly quest boundary is required';
  end if;
  if p_day_key not in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') then
    raise exception 'Invalid weekly quest day';
  end if;
  if p_day_key <> (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[
    extract(isodow from p_earned_for_day)::integer
  ] then
    raise exception 'Weekday does not match local date';
  end if;

  select u.id into v_locked_user_id
  from public.users u
  where u.id = p_user_id
    and u.family_id = v_family_id
    and u.deleted_at is null
  for update;
  if not found then raise exception 'Member not found'; end if;

  v_week_start := p_earned_for_day - (extract(isodow from p_earned_for_day)::integer - 1);
  if extract(isodow from p_earned_for_day) <= 5 then
    v_reward_slot := 1;
    v_reward_kind := 'weekday';
    v_required_days := 3;
  else
    v_reward_slot := 2;
    v_reward_kind := 'weekend';
    v_required_days := 2;
  end if;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and t.task_type = 'required'
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'morning'
      )
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(
        p_day_start, due.time_window, 'morning'
      )
      and tc.completed_at < public.task_completion_window_end(
        p_day_start, due.time_window, 'morning'
      )
  )) into v_morning_due, v_morning_done from due;

  with due as (
    select t.id, t.time_window
    from public.tasks t
    where t.user_id = p_user_id
      and t.family_id = v_family_id
      and t.active = 1
      and t.deleted_at is null
      and t.task_type = 'required'
      and public.task_is_due_today(
        t.days_of_week, t.recurrence, t.time_window, p_day_key, 'evening'
      )
  )
  select count(*), count(*) filter (where exists (
    select 1 from public.task_completions tc
    where tc.user_id = p_user_id
      and tc.task_id = due.id
      and tc.completed_at >= public.task_completion_window_start(
        p_day_start, due.time_window, 'evening'
      )
      and tc.completed_at < public.task_completion_window_end(
        p_day_start, due.time_window, 'evening'
      )
  )) into v_evening_due, v_evening_done from due;

  if v_morning_due = 0 or v_evening_due = 0
    or v_morning_done <> v_morning_due
    or v_evening_done <> v_evening_due
  then
    v_quest := public.school_week_quest_progress_for_member(
      p_user_id, v_family_id, p_earned_for_day
    ) || jsonb_build_object('couponsAwarded', 0, 'rewardKind', null);
    return jsonb_build_object('awarded', false, 'coupons', v_coupons, 'quest', v_quest);
  end if;

  insert into public.school_week_quest_marks (
    family_id, user_id, week_start, earned_for_day, day_started_at, created_at
  ) values (
    v_family_id, p_user_id, v_week_start, p_earned_for_day, p_day_start, p_now
  )
  on conflict (user_id, earned_for_day) do nothing;

  select count(*)::integer into v_qualifying_days
  from public.school_week_quest_marks m
  where m.family_id = v_family_id
    and m.user_id = p_user_id
    and m.week_start = v_week_start
    and (
      (v_reward_slot = 1 and extract(isodow from m.earned_for_day) between 1 and 5)
      or (v_reward_slot = 2 and extract(isodow from m.earned_for_day) between 6 and 7)
    );

  select * into v_coupon
  from public.perfect_day_coupons c
  where c.family_id = v_family_id
    and c.user_id = p_user_id
    and c.week_start = v_week_start
    and c.reward_slot = v_reward_slot
  for update;

  if v_qualifying_days >= v_required_days then
    if not found then
      insert into public.perfect_day_coupons (
        family_id, user_id, day_started_at, earned_for_day, status,
        awarded_at, updated_at, quest_day, chain_length, reward_slot, week_start
      ) values (
        v_family_id,
        p_user_id,
        (v_week_start::timestamp + interval '12 hours') at time zone 'UTC',
        p_earned_for_day,
        'available',
        p_now,
        p_now,
        3,
        v_qualifying_days,
        v_reward_slot,
        v_week_start
      )
      returning * into v_coupon;
      v_awarded := true;
    elsif v_coupon.status = 'revoked' then
      update public.perfect_day_coupons
      set status = 'available',
          redeemed_for = null,
          redeemed_at = null,
          earned_for_day = p_earned_for_day,
          awarded_at = p_now,
          updated_at = p_now,
          chain_length = v_qualifying_days
      where id = v_coupon.id
      returning * into v_coupon;
      v_awarded := true;
    end if;
  end if;

  if v_coupon.id is not null and v_coupon.status <> 'revoked' then
    v_coupons := jsonb_build_array(jsonb_build_object(
      'id', v_coupon.id,
      'familyId', v_coupon.family_id,
      'userId', v_coupon.user_id, 'ownerId', v_coupon.owner_id,
      'earnedForDay', v_coupon.earned_for_day,
      'status', v_coupon.status,
      'redeemedFor', v_coupon.redeemed_for,
      'awardedAt', v_coupon.awarded_at,
      'redeemedAt', v_coupon.redeemed_at,
      'questDay', 3,
      'chainLength', v_qualifying_days,
      'rewardSlot', v_reward_slot
    ));
  end if;

  v_quest := public.school_week_quest_progress_for_member(
    p_user_id, v_family_id, p_earned_for_day
  ) || jsonb_build_object(
    'couponsAwarded', case when v_awarded then 1 else 0 end,
    'rewardKind', case when v_awarded then v_reward_kind else null end
  );

  return jsonb_build_object(
    'awarded', v_awarded,
    'coupons', v_coupons,
    'quest', v_quest
  );
end;
$function$;

-- perfect_quest_day_is_eligible: bonus tasks are never due.
CREATE OR REPLACE FUNCTION public.perfect_quest_day_is_eligible(p_user_id text, p_family_id uuid, p_day date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    exists (
      select 1
      from public.tasks t
      where t.user_id = p_user_id
        and t.family_id = p_family_id
        and t.active = 1
        and t.deleted_at is null
        and t.task_type = 'required'
        and public.task_is_due_today(
          t.days_of_week,
          t.recurrence,
          t.time_window,
          (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from p_day)::integer],
          'morning'
        )
    )
    and exists (
      select 1
      from public.tasks t
      where t.user_id = p_user_id
        and t.family_id = p_family_id
        and t.active = 1
        and t.deleted_at is null
        and t.task_type = 'required'
        and public.task_is_due_today(
          t.days_of_week,
          t.recurrence,
          t.time_window,
          (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from p_day)::integer],
          'evening'
        )
    );
$function$;

-- capture_shield_daily_schedules: bonus tasks are never due.
CREATE OR REPLACE FUNCTION public.capture_shield_daily_schedules(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family record;
  v_tz text;
  v_local timestamp;
  v_day date;
  v_day_key text;
  v_inserted integer := 0;
  v_count integer;
begin
  for v_family in select id from public.families loop
    v_tz := public.shield_family_timezone(v_family.id);
    v_local := p_now at time zone v_tz;
    v_day := v_local::date;
    v_day_key := case extract(isodow from v_day)
      when 1 then 'MON' when 2 then 'TUE' when 3 then 'WED'
      when 4 then 'THU' when 5 then 'FRI' when 6 then 'SAT' else 'SUN' end;

    insert into public.shield_daily_schedules (family_id, user_id, day, timezone, slots, source, captured_at)
    select
      v_family.id,
      u.id,
      v_day,
      v_tz,
      coalesce((
        select jsonb_agg(jsonb_build_object('taskId', t.id, 'title', t.title, 'icon', t.icon, 'window', w.win) order by t.sort_order, t.id, w.win)
        from public.tasks t
        cross join (values ('morning'), ('evening')) as w(win)
        where t.user_id = u.id
          and t.family_id = v_family.id
          and t.active = 1
          and t.deleted_at is null
          and t.task_type = 'required'
          and public.task_is_due_today(t.days_of_week, t.recurrence, t.time_window, v_day_key, w.win)
      ), '[]'::jsonb),
      case when extract(hour from v_local) < 3 then 'on_time' else 'late' end,
      p_now
    from public.users u
    where u.family_id = v_family.id and u.deleted_at is null
    on conflict (user_id, day) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;
  return v_inserted;
end;
$function$;

