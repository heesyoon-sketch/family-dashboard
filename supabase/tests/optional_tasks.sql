-- Exercises optional (bonus) tasks against the live RPCs. Everything runs in
-- one transaction and is rolled back; no tasks, points or penalties are kept.
-- Run: npx supabase db query --linked --file supabase/tests/optional_tasks.sql
begin;

create temporary table optional_task_test (
  member_id text,
  family_id uuid,
  required_id text,
  optional_id text
) on commit drop;
grant all on optional_task_test to authenticated;

do $$
declare
  v_auth uuid;
begin
  select u.auth_user_id into v_auth
  from public.users u
  where u.role = 'PARENT' and u.deleted_at is null and u.auth_user_id is not null
    and u.id = (
      select latest.id from public.users latest
      where latest.auth_user_id = u.auth_user_id and latest.family_id is not null
      order by latest.created_at desc limit 1
    )
  order by u.created_at limit 1;
  if v_auth is null then raise exception 'Test needs an auth-linked parent'; end if;
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
end;
$$;

set local role authenticated;

-- 1 & 2. Parents create required and optional tasks through the same RPC.
do $$
declare
  v_member text;
  v_family uuid := public.get_my_family_id();
  v_required public.tasks;
  v_optional public.tasks;
  v_days text[] := array['MON','TUE','WED','THU','FRI','SAT','SUN'];
begin
  select u.id into v_member from public.users u
  where u.auth_user_id = auth.uid() and u.family_id = v_family and u.deleted_at is null
  limit 1;

  v_required := public.admin_insert_task(v_member, 'TEST required', 'check-circle', 'MEDIUM', 10, 'daily', v_days, 1, 900);
  if v_required.task_type is distinct from 'required' then
    raise exception 'Omitting p_task_type must create a required task, got %', v_required.task_type;
  end if;

  v_optional := public.admin_insert_task(v_member, 'TEST bonus', 'book-open', 'MEDIUM', 10, 'daily', v_days, 1, 901, 'optional');
  if v_optional.task_type is distinct from 'optional' then
    raise exception 'p_task_type optional was not stored, got %', v_optional.task_type;
  end if;
  if v_optional.time_window is distinct from 'both' then
    raise exception 'Bonus tasks must be available all day, got %', v_optional.time_window;
  end if;
  v_optional := public.admin_update_task(v_optional.id, '{"time_window":"morning"}'::jsonb);
  if v_optional.task_type is distinct from 'optional' or v_optional.time_window <> 'both' then
    raise exception 'Bonus tasks must stay optional and all-day: % %', v_optional.task_type, v_optional.time_window;
  end if;
  v_required := public.admin_update_task(v_required.id, '{"task_type":"optional"}'::jsonb);
  if v_required.time_window <> 'both' then
    raise exception 'Switching a task to bonus must make it all-day';
  end if;
  v_required := public.admin_update_task(v_required.id, '{"task_type":"required"}'::jsonb);

  begin
    perform public.admin_insert_task(v_member, 'TEST bad', 'circle', 'MEDIUM', 10, 'daily', v_days, 1, 902, 'sometimes');
    raise exception 'An invalid task type was accepted';
  exception when others then
    if sqlerrm not like '%Invalid task type%' then raise; end if;
  end;

  insert into optional_task_test values (v_member, v_family, v_required.id, v_optional.id);
end;
$$;

-- 4 & 12. A bonus task pays once per day: morning or evening, never both.
do $$
declare
  r optional_task_test;
  v_tz constant text := 'Asia/Seoul';
  v_local timestamp := now() at time zone v_tz;
  v_day_start timestamptz := date_trunc('day', v_local) at time zone v_tz;
  v_day_key text := (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from v_local)::int];
  v_morning timestamptz := v_day_start + interval '9 hours';
  v_evening timestamptz := v_day_start + interval '15 hours';
  v_first jsonb;
  v_repeat jsonb;
  v_balance_before integer;
  v_balance_after_first integer;
  v_revoked_before integer;
begin
  select * into r from optional_task_test;
  select coalesce(spendable_balance, 0) into v_balance_before from public.levels where user_id = r.member_id;
  select count(*) into v_revoked_before from public.perfect_day_coupons where user_id = r.member_id and status = 'revoked';

  v_first := public.process_task_completion_atomic(r.member_id, r.optional_id, false, v_day_start, v_day_key, 'morning', v_morning, 0);
  if coalesce((v_first->>'pointsAwarded')::int, 0) < 10 then
    raise exception 'Bonus completion must award at least its base points: %', v_first;
  end if;
  select spendable_balance into v_balance_after_first from public.levels where user_id = r.member_id;

  v_repeat := public.process_task_completion_atomic(r.member_id, r.optional_id, false, v_day_start, v_day_key, 'morning', v_morning + interval '1 minute', 0);
  if coalesce((v_repeat->>'pointsAwarded')::int, -1) <> 0 then
    raise exception 'Repeating a bonus task in the same window must award 0: %', v_repeat;
  end if;
  v_repeat := public.process_task_completion_atomic(r.member_id, r.optional_id, false, v_day_start, v_day_key, 'evening', v_evening, 0);
  if coalesce((v_repeat->>'pointsAwarded')::int, -1) <> 0 then
    raise exception 'A bonus task done this morning must not pay again this evening: %', v_repeat;
  end if;
  if (select spendable_balance from public.levels where user_id = r.member_id) <> v_balance_after_first
    or (select count(*) from public.task_completions where task_id = r.optional_id) <> 1 then
    raise exception 'Repeat completions changed the balance or added records';
  end if;

  -- Undo from the evening finds the morning completion and refunds it.
  perform public.process_task_undo_atomic(r.member_id, r.optional_id, v_day_start, v_day_key, 'evening', v_evening + interval '1 minute');
  if (select count(*) from public.task_completions where task_id = r.optional_id) <> 0 then
    raise exception 'Evening undo must remove the day''s bonus completion';
  end if;
  if (select coalesce(spendable_balance, 0) from public.levels where user_id = r.member_id) <> v_balance_before then
    raise exception 'Undo must refund the bonus points exactly';
  end if;
  if (select count(*) from public.perfect_day_coupons where user_id = r.member_id and status = 'revoked') <> v_revoked_before then
    raise exception 'Undoing a bonus task must not revoke coupons';
  end if;
end;
$$;

reset role;

-- 5, 7 & 8. With only a bonus task left, the member is never "due".
do $$
declare
  r optional_task_test;
  v_tz constant text := 'Asia/Seoul';
  v_local timestamp := now() at time zone v_tz;
  v_day_start timestamptz := date_trunc('day', v_local) at time zone v_tz;
  v_day_key text := (array['MON','TUE','WED','THU','FRI','SAT','SUN'])[extract(isodow from v_local)::int];
  v_future timestamptz := now() + interval '40 days';
  v_slots jsonb;
  v_result jsonb;
begin
  select * into r from optional_task_test;
  -- Leave the member with nothing but the (incomplete) bonus task. Rolled back.
  update public.tasks set active = 0 where user_id = r.member_id and id <> r.optional_id;

  if public.perfect_quest_day_is_eligible(r.member_id, r.family_id, v_local::date) then
    raise exception 'A bonus task alone must not make a day quest-eligible';
  end if;

  perform public.capture_shield_daily_schedules(v_future);
  select slots into v_slots from public.shield_daily_schedules
  where user_id = r.member_id and day = (v_future at time zone public.shield_family_timezone(r.family_id))::date;
  if v_slots is null then raise exception 'Future snapshot was not captured'; end if;
  if v_slots @> jsonb_build_array(jsonb_build_object('taskId', r.optional_id)) then
    raise exception 'Shield snapshots must not include bonus tasks: %', v_slots;
  end if;

  if extract(hour from v_local) >= 12 then
    v_result := public.apply_morning_routine_penalties_before_sale_exemption(v_day_start, v_day_key, v_local::date);
    if v_result->'penalties' @> jsonb_build_array(jsonb_build_object('userId', r.member_id)) then
      raise exception 'Skipping a bonus task produced a routine penalty: %', v_result;
    end if;
  else
    raise notice 'Skipped the penalty check: the morning deadline has not passed yet';
  end if;
end;
$$;

rollback;
select 'PASS: required default, optional all-day create/edit, invalid type rejected, one payout per day, evening undo refunds, no quest/shield/penalty effect; rolled back' as result;
