-- Bonus tasks are day-scoped.
--
-- A bonus task is available all day (both windows) and pays once per day,
-- whichever window it is completed in. Required tasks keep their per-window
-- behavior. The child 22:00 routine cutoff still applies to every task.
-- Undoing a bonus task no longer revokes (or is blocked by) that day's
-- Perfect Day coupon, since bonus tasks never counted toward it.

update public.tasks set time_window = 'both'
where task_type = 'optional' and time_window <> 'both';

CREATE OR REPLACE FUNCTION public.admin_insert_task(p_user_id text, p_title text, p_icon text, p_difficulty text, p_base_points integer, p_recurrence text, p_days_of_week text[], p_active integer, p_sort_order integer, p_task_type text DEFAULT 'required'::text)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_task public.tasks;
  v_task_type text := coalesce(p_task_type, 'required');
begin
  if not exists (select 1 from public.users where id = p_user_id and family_id = v_family_id) then
    raise exception 'User is not in your family';
  end if;
  if v_task_type not in ('required', 'optional') then
    raise exception 'Invalid task type';
  end if;

  insert into public.tasks (
    id, user_id, title, icon, difficulty, base_points, recurrence,
    days_of_week, active, sort_order, family_id, task_type, time_window
  )
  values (
    gen_random_uuid()::text, p_user_id, trim(p_title), p_icon, p_difficulty,
    public.normalize_task_base_points(p_base_points), p_recurrence,
    p_days_of_week, p_active, p_sort_order, v_family_id, v_task_type,
    case when v_task_type = 'optional' then 'both' else 'evening' end
  )
  returning * into v_task;

  return v_task;
end;
$function$;

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
      -- Bonus tasks always span the whole day.
      time_window = case
        when coalesce(p_patch->>'task_type', task_type) = 'optional' then 'both'
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

-- process_task_completion_atomic_before_routine_deadlines: bonus tasks use the whole day as their window.
CREATE OR REPLACE FUNCTION public.process_task_completion_atomic_before_routine_deadlines(p_user_id text, p_task_id text, p_partial boolean, p_day_start timestamp with time zone, p_day_key text, p_time_window text, p_now timestamp with time zone, p_bonus_percent numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_task public.tasks;
  v_level public.levels;
  v_existing_completion public.task_completions;
  v_streak public.streaks;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_achievement_categories text[];
  v_streak_before integer;
  v_last_completed_before timestamptz;
  v_gap integer;
  v_streak_current integer;
  v_streak_longest integer;
  v_base_points integer;
  v_bonus_pct numeric;
  v_points integer;
  v_old_level integer;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
  v_max_streak integer;
  v_longest_streak integer;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  select t.* into v_task
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id
    and t.user_id = p_user_id
    and u.family_id = v_family_id
  for update of t;

  if not found then
    raise exception 'Task % not found', p_task_id;
  end if;

  if not public.task_is_due_today(
    v_task.days_of_week,
    v_task.recurrence,
    v_task.time_window,
    p_day_key,
    p_time_window
  ) then
    raise exception 'Task % is not due in the current window', p_task_id;
  end if;

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);
  -- Bonus tasks are day-scoped: one completion per day, from either window.
  if v_task.task_type = 'optional' then
    v_completion_window_start := p_day_start;
    v_completion_window_end := p_day_start + interval '1 day';
  end if;
  v_achievement_categories := public.task_achievement_categories(v_task.title, v_task.icon, v_task.time_window);

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  select * into v_existing_completion
  from public.task_completions
  where user_id = p_user_id
    and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc
  limit 1
  for update;

  if found then
    select * into v_streak
    from public.streaks
    where user_id = p_user_id and task_id = p_task_id
    order by last_completed_at desc nulls last
    limit 1;

    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks
    where user_id = p_user_id;

    return jsonb_build_object(
      'pointsAwarded', 0,
      'level', jsonb_build_object(
        'userId', p_user_id,
        'currentLevel', coalesce(v_level.current_level, 1),
        'totalPoints', coalesce(v_level.total_points, 0),
        'spendableBalance', coalesce(v_level.spendable_balance, 0),
        'updatedAt', coalesce(v_level.updated_at, p_now)
      ),
      'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'streakCurrent', coalesce(v_streak.current, v_task.streak_count, 0),
      'streakLongest', coalesce(v_streak.longest, v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at
    );
  end if;

  v_streak_before := coalesce(v_task.streak_count, 0);
  v_last_completed_before := v_task.last_completed_at;

  v_gap := case
    when v_last_completed_before is null then 999
    when v_last_completed_before >= p_day_start then 0
    when v_last_completed_before >= p_day_start - interval '1 day' then 1
    else 999
  end;

  v_streak_current := case
    when v_gap = 0 then greatest(v_streak_before, 1)
    when v_gap = 1 then v_streak_before + 1
    else 1
  end;

  v_base_points := case
    when p_partial then ceil(v_task.base_points * 0.5)::integer
    else v_task.base_points
  end;

  v_bonus_pct := greatest(0::numeric, least(50::numeric, coalesce(p_bonus_percent, 0)));
  v_points := ceil(v_base_points * (1 + v_bonus_pct / 100.0))::integer;
  v_points := public.apply_streak_bonus(v_points, v_streak_current);

  v_old_level := coalesce(v_level.current_level, 1);
  v_new_total := coalesce(v_level.total_points, 0) + v_points;
  v_new_balance := coalesce(v_level.spendable_balance, 0) + v_points;
  v_new_level := public.level_for_points(v_new_total);

  select * into v_streak
  from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last
  limit 1
  for update;

  v_streak_longest := greatest(coalesce(v_streak.longest, 0), v_streak_current);

  insert into public.task_completions (
    id, user_id, task_id, completed_at, points_awarded,
    streak_before, last_completed_before, partial, forgiveness_used,
    achievement_categories
  )
  values (
    gen_random_uuid()::text, p_user_id, p_task_id, p_now, v_points,
    v_streak_before, v_last_completed_before, p_partial, false,
    v_achievement_categories
  );

  update public.tasks
  set streak_count = v_streak_current,
      last_completed_at = p_now
  where id = p_task_id;

  if v_streak.id is null then
    insert into public.streaks (id, user_id, task_id, current, longest, last_completed_at)
    values (gen_random_uuid()::text, p_user_id, p_task_id, v_streak_current, v_streak_longest, p_now);
  else
    update public.streaks
    set current = v_streak_current,
        longest = v_streak_longest,
        last_completed_at = p_now
    where id = v_streak.id;
  end if;

  update public.levels
  set current_level = v_new_level,
      total_points = v_new_total,
      spendable_balance = v_new_balance,
      updated_at = p_now
  where user_id = p_user_id;

  select coalesce(max(current), 0), coalesce(max(longest), 0)
    into v_max_streak, v_longest_streak
  from public.streaks
  where user_id = p_user_id;

  return jsonb_build_object(
    'pointsAwarded', v_points,
    'level', jsonb_build_object(
      'userId', p_user_id,
      'currentLevel', v_new_level,
      'totalPoints', v_new_total,
      'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'leveledUp', v_new_level > v_old_level,
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'streakCurrent', v_streak_current,
    'streakLongest', v_streak_longest,
    'taskLastCompletedAt', p_now
  );
end;
$function$;

-- process_task_undo_atomic_before_routine_deadlines: bonus tasks use the whole day as their window.
CREATE OR REPLACE FUNCTION public.process_task_undo_atomic_before_routine_deadlines(p_user_id text, p_task_id text, p_day_start timestamp with time zone, p_day_key text, p_time_window text, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_task public.tasks;
  v_level public.levels;
  v_completion public.task_completions;
  v_streak public.streaks;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_points_to_deduct integer;
  v_restored_streak integer;
  v_new_total integer;
  v_new_balance integer;
  v_new_level integer;
  v_max_streak integer;
  v_longest_streak integer;
  v_revoked_coupon_ids uuid[] := array[]::uuid[];
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select t.* into v_task
  from public.tasks t
  join public.users u on u.id = t.user_id
  where t.id = p_task_id and t.user_id = p_user_id
    and u.family_id = v_family_id
  for update of t;
  if not found then raise exception 'Task % not found', p_task_id; end if;

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);
  -- Bonus tasks are day-scoped: one completion per day, from either window.
  if v_task.task_type = 'optional' then
    v_completion_window_start := p_day_start;
    v_completion_window_end := p_day_start + interval '1 day';
  end if;

  select * into v_completion
  from public.task_completions
  where user_id = p_user_id and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc limit 1 for update;

  if not found then
    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks where user_id = p_user_id;
    return jsonb_build_object(
      'level', null, 'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'taskStreakCount', coalesce(v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at,
      'revokedCouponId', null,
      'revokedCouponIds', '[]'::jsonb
    );
  end if;

  -- Undoing a bonus task never touches the day's Perfect Day coupon: bonus
  -- tasks were never part of earning it.
  if v_task.task_type <> 'optional' then
    perform 1 from public.perfect_day_coupons
    where user_id = p_user_id and family_id = v_family_id
      and day_started_at = p_day_start
    for update;

    if exists (
      select 1 from public.perfect_day_coupons
      where user_id = p_user_id and family_id = v_family_id
        and day_started_at = p_day_start and status = 'redeemed'
    ) then
      raise exception '이미 사용한 퍼펙트 데이 쿠폰이 있어 완료를 취소할 수 없어요';
    end if;

    select coalesce(array_agg(id order by reward_slot), array[]::uuid[])
      into v_revoked_coupon_ids
    from public.perfect_day_coupons
    where user_id = p_user_id and family_id = v_family_id
      and day_started_at = p_day_start and status = 'available';

    update public.perfect_day_coupons
    set status = 'revoked', updated_at = p_now
    where id = any(v_revoked_coupon_ids);
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now) on conflict (user_id) do nothing;
  select * into v_level from public.levels where user_id = p_user_id for update;

  select * into v_streak from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last limit 1 for update;

  v_points_to_deduct := greatest(coalesce(v_completion.points_awarded, 0), 0);
  if coalesce(v_level.spendable_balance, 0) < v_points_to_deduct then
    raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
  end if;

  v_restored_streak := greatest(coalesce(v_completion.streak_before, 0), 0);
  v_new_total := greatest(coalesce(v_level.total_points, 0) - v_points_to_deduct, 0);
  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_points_to_deduct, 0);
  v_new_level := public.level_for_points(v_new_total);

  delete from public.task_completions where id = v_completion.id;
  update public.tasks set streak_count = v_restored_streak,
    last_completed_at = v_completion.last_completed_before where id = p_task_id;
  if v_streak.id is not null then
    update public.streaks set current = v_restored_streak,
      last_completed_at = v_completion.last_completed_before where id = v_streak.id;
  end if;
  update public.levels set current_level = v_new_level,
    total_points = v_new_total, spendable_balance = v_new_balance,
    updated_at = p_now where user_id = p_user_id;

  select coalesce(max(current), 0), coalesce(max(longest), 0)
    into v_max_streak, v_longest_streak
  from public.streaks where user_id = p_user_id;

  return jsonb_build_object(
    'level', jsonb_build_object(
      'userId', p_user_id, 'currentLevel', v_new_level,
      'totalPoints', v_new_total, 'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'taskStreakCount', v_restored_streak,
    'taskLastCompletedAt', v_completion.last_completed_before,
    'revokedCouponId', v_revoked_coupon_ids[1],
    'revokedCouponIds', to_jsonb(v_revoked_coupon_ids)
  );
end;
$function$;

-- process_task_undo_atomic: reverse the Shield bonus of the day's bonus completion.
CREATE OR REPLACE FUNCTION public.process_task_undo_atomic(p_user_id text, p_task_id text, p_day_start timestamp with time zone, p_day_key text, p_time_window text, p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_family_id uuid := public.get_my_family_id();
  v_role text;
  v_expected_window text;
  v_sale_context jsonb;
  v_sale_day boolean := false;
  -- Shield equipment
  v_undo_task public.tasks;
  v_undo_completion text;
  v_undo_points integer;
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
    and p_time_window = 'evening' and p_now >= p_day_start + interval '22 hours'
  then
    raise exception '아이 루틴 마감 시간이 지났어요';
  end if;

  -- Reverse the Shield bonus of the completion about to be undone (same row
  -- the inner function deletes). Raises if the bonus was already spent, which
  -- rolls back the whole undo.
  select tt.* into v_undo_task from public.tasks tt where tt.id = p_task_id and tt.user_id = p_user_id;
  select c.id, c.points_awarded into v_undo_completion, v_undo_points
  from public.task_completions c
  where c.user_id = p_user_id and c.task_id = p_task_id
    and c.completed_at >= case when v_undo_task.task_type = 'optional' then p_day_start
      else public.task_completion_window_start(p_day_start, v_undo_task.time_window, p_time_window) end
    and c.completed_at < case when v_undo_task.task_type = 'optional' then p_day_start + interval '1 day'
      else public.task_completion_window_end(p_day_start, v_undo_task.time_window, p_time_window) end
  order by c.completed_at desc limit 1;
  if v_undo_completion is not null then
    perform public.reverse_shield_bonus(v_undo_completion, p_user_id, v_undo_points);
  end if;

  return public.process_task_undo_atomic_before_routine_deadlines(
    p_user_id, p_task_id, p_day_start, p_day_key, p_time_window, p_now
  );
end;
$function$;

-- reconcile_school_week_mark_on_completion_delete: ignore bonus completions.
CREATE OR REPLACE FUNCTION public.reconcile_school_week_mark_on_completion_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mark public.school_week_quest_marks%rowtype;
  v_mark_count integer;
  v_reward_slot integer;
  v_required_days integer;
  v_coupon public.perfect_day_coupons%rowtype;
begin
  -- Bonus completions never earned a quest mark, so removing one leaves it alone.
  if exists (select 1 from public.tasks t where t.id = old.task_id and t.task_type = 'optional') then
    return old;
  end if;

  perform 1 from public.users where id = old.user_id for update;

  select * into v_mark
  from public.school_week_quest_marks m
  where m.user_id = old.user_id
    and old.completed_at >= m.day_started_at
    and old.completed_at < m.day_started_at + interval '1 day'
  order by m.day_started_at desc
  limit 1
  for update;

  if not found then return old; end if;

  if extract(isodow from v_mark.earned_for_day) <= 5 then
    v_reward_slot := 1;
    v_required_days := 3;
  else
    v_reward_slot := 2;
    v_required_days := 2;
  end if;

  select count(*)::integer into v_mark_count
  from public.school_week_quest_marks m
  where m.user_id = v_mark.user_id
    and m.family_id = v_mark.family_id
    and m.week_start = v_mark.week_start
    and (
      (v_reward_slot = 1 and extract(isodow from m.earned_for_day) between 1 and 5)
      or (v_reward_slot = 2 and extract(isodow from m.earned_for_day) between 6 and 7)
    );

  if v_mark_count <= v_required_days then
    select * into v_coupon
    from public.perfect_day_coupons c
    where c.user_id = v_mark.user_id
      and c.family_id = v_mark.family_id
      and c.week_start = v_mark.week_start
      and c.reward_slot = v_reward_slot
    for update;

    if found and v_coupon.status = 'redeemed' then
      raise exception '이미 사용한 주간 퀘스트 이용권이 있어 완료를 취소할 수 없어요';
    end if;

    if found and v_coupon.status = 'available' then
      update public.perfect_day_coupons
      set status = 'revoked', updated_at = now()
      where id = v_coupon.id;
    end if;
  end if;

  delete from public.school_week_quest_marks where id = v_mark.id;
  return old;
end;
$function$;
