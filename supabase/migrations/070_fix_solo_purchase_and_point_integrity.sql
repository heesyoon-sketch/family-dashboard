-- Migration 070: Fix solo reward purchase logging and tighten point integrity.
--
-- 1. Migration 065 regressed solo reward activity logging by inserting
--    reward_redemptions.user_id (text) directly into family_activities.user_id
--    (uuid). Joint purchases use joint_user*_id uuid columns, so only solo
--    purchases failed.
-- 2. Task completion duplicate detection previously stopped at p_now. A stale
--    offline action or skewed device clock could therefore miss a later
--    completion in the same task window and award points twice.
-- 3. Reconcile level totals to the durable earning ledger:
--    task_completions.points_awarded + positive SYSTEM_MESSAGE bonuses.

create or replace function public.log_reward_redemption_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_reward_title text;
  v_user1_name text;
  v_user2_name text;
  v_user1_amount integer;
  v_user2_amount integer;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  select u.family_id, coalesce(r.title, '(deleted reward)')
  into v_family_id, v_reward_title
  from public.users u
  left join public.rewards r on r.id = new.reward_id
  where u.id = new.user_id::text;

  if v_family_id is null then
    return new;
  end if;

  if coalesce(new.is_joint_purchase, false) then
    select name into v_user1_name from public.users where id = new.joint_user1_id::text;
    select name into v_user2_name from public.users where id = new.joint_user2_id::text;

    v_user1_amount := greatest(coalesce(new.joint_user1_amount, 0), 0);
    v_user2_amount := greatest(coalesce(new.joint_user2_amount, 0), 0);

    if new.joint_user1_id is not null and v_user1_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user1_id,
        'REWARD_PURCHASED',
        v_user1_amount,
        coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt + ' ||
          coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt',
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;

    if new.joint_user2_id is not null and v_user2_amount > 0 then
      insert into public.family_activities (
        family_id, user_id, type, amount, related_user_name, message, created_at
      )
      values (
        v_family_id,
        new.joint_user2_id,
        'REWARD_PURCHASED',
        v_user2_amount,
        coalesce(v_user2_name, '?') || ' ' || v_user2_amount || 'pt + ' ||
          coalesce(v_user1_name, '?') || ' ' || v_user1_amount || 'pt',
        v_reward_title,
        coalesce(new.redeemed_at, now())
      );
    end if;
  elsif new.user_id::text ~* v_uuid_pattern then
    insert into public.family_activities (
      family_id, user_id, type, amount, message, created_at
    )
    values (
      v_family_id,
      new.user_id::uuid,
      'REWARD_PURCHASED',
      coalesce(new.cost_charged, 0),
      v_reward_title,
      coalesce(new.redeemed_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_reward_redemption_activity on public.reward_redemptions;
create trigger trg_log_reward_redemption_activity
after insert on public.reward_redemptions
for each row
execute function public.log_reward_redemption_activity();

create or replace function public.redeem_reward_atomic(
  p_user_id text,
  p_reward_id text,
  p_day_key text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_level public.levels;
  v_reward public.rewards;
  v_base_cost integer;
  v_sale_percentage integer;
  v_sale_price integer;
  v_current_cost integer;
  v_new_balance integer;
  v_now timestamptz := coalesce(p_now, now());
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'redeem:' || v_family_id::text || ':' || p_user_id || ':' || p_reward_id,
    0
  ));

  if not exists (
    select 1
    from public.users
    where id = p_user_id
      and family_id = v_family_id
      and deleted_at is null
  ) then
    raise exception 'User % not found', p_user_id;
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id::uuid
    and family_id = v_family_id
  for update;

  if not found then
    raise exception 'Reward % not found', p_reward_id;
  end if;

  if coalesce(v_reward.is_hidden, false) then
    raise exception 'Reward is not available';
  end if;

  if coalesce(v_reward.is_sold_out, false) then
    raise exception '품절된 보상입니다';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, v_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  v_base_cost := greatest(coalesce(v_reward.cost_points, 0), 0);
  v_sale_percentage := case
    when coalesce(v_reward.sale_enabled, false)
      then least(100, greatest(0, coalesce(v_reward.sale_percentage, 0)))
    else 0
  end;
  v_sale_price := case
    when coalesce(v_reward.sale_enabled, false) and v_reward.sale_price is not null
      then least(v_base_cost, greatest(0, v_reward.sale_price))
    else null
  end;
  v_current_cost := coalesce(
    v_sale_price,
    greatest(floor(v_base_cost - (v_base_cost * v_sale_percentage / 100.0))::integer, 0)
  );

  if exists (
    select 1
    from public.reward_redemptions rr
    where rr.user_id = p_user_id
      and rr.reward_id = p_reward_id::uuid
      and coalesce(rr.is_joint_purchase, false) = false
      and rr.refunded_at is null
      and rr.redeemed_at >= v_now - interval '3 seconds'
  ) then
    raise exception '이미 처리된 구매입니다. 잠시 후 다시 시도해주세요.';
  end if;

  if coalesce(v_level.spendable_balance, 0) < v_current_cost then
    raise exception '잔액이 부족합니다';
  end if;

  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_current_cost, 0);

  update public.levels
  set spendable_balance = v_new_balance,
      updated_at = v_now
  where user_id = p_user_id;

  insert into public.reward_redemptions (id, user_id, reward_id, redeemed_at, cost_charged)
  values (gen_random_uuid(), p_user_id, p_reward_id::uuid, v_now, v_current_cost);

  return jsonb_build_object(
    'spendableBalance', v_new_balance,
    'costCharged', v_current_cost,
    'baseCost', v_base_cost,
    'salePercentage', v_sale_percentage,
    'salePrice', v_sale_price,
    'saleName', v_reward.sale_name,
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;

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

  v_completion_window_start := case
    when v_task.time_window = 'afternoon' then p_day_start + interval '12 hours'
    when v_task.time_window = 'evening' then p_day_start + interval '18 hours'
    else p_day_start
  end;
  v_completion_window_end := case
    when v_task.time_window = 'morning' then p_day_start + interval '12 hours'
    when v_task.time_window = 'afternoon' then p_day_start + interval '18 hours'
    else p_day_start + interval '1 day'
  end;

  select * into v_completion
  from public.task_completions
  where user_id = p_user_id
    and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at < v_completion_window_end
  order by completed_at desc
  limit 1
  for update;

  if not found then
    select coalesce(max(current), 0), coalesce(max(longest), 0)
      into v_max_streak, v_longest_streak
    from public.streaks
    where user_id = p_user_id;

    return jsonb_build_object(
      'level', null,
      'maxStreak', v_max_streak,
      'longestStreak', v_longest_streak,
      'taskStreakCount', coalesce(v_task.streak_count, 0),
      'taskLastCompletedAt', v_task.last_completed_at
    );
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  select * into v_streak
  from public.streaks
  where user_id = p_user_id and task_id = p_task_id
  order by last_completed_at desc nulls last
  limit 1
  for update;

  v_points_to_deduct := greatest(coalesce(v_completion.points_awarded, 0), 0);
  v_restored_streak := greatest(coalesce(v_completion.streak_before, 0), 0);
  v_new_total := greatest(coalesce(v_level.total_points, 0) - v_points_to_deduct, 0);
  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_points_to_deduct, 0);
  v_new_level := public.level_for_points(v_new_total);

  delete from public.task_completions
  where id = v_completion.id;

  update public.tasks
  set streak_count = v_restored_streak,
      last_completed_at = v_completion.last_completed_before
  where id = p_task_id;

  if v_streak.id is not null then
    update public.streaks
    set current = v_restored_streak,
        last_completed_at = v_completion.last_completed_before
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
    'level', jsonb_build_object(
      'userId', p_user_id,
      'currentLevel', v_new_level,
      'totalPoints', v_new_total,
      'spendableBalance', v_new_balance,
      'updatedAt', p_now
    ),
    'maxStreak', v_max_streak,
    'longestStreak', v_longest_streak,
    'taskStreakCount', v_restored_streak,
    'taskLastCompletedAt', v_completion.last_completed_before
  );
end;
$$;

create or replace function public.process_task_completion_atomic(
  p_user_id text,
  p_task_id text,
  p_partial boolean,
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
  v_task public.tasks;
  v_level public.levels;
  v_existing_completion public.task_completions;
  v_streak public.streaks;
  v_completion_window_start timestamptz;
  v_completion_window_end timestamptz;
  v_streak_before integer;
  v_last_completed_before timestamptz;
  v_gap integer;
  v_streak_current integer;
  v_streak_longest integer;
  v_points integer;
  v_active_count integer;
  v_today_count integer;
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

  v_completion_window_start := case
    when v_task.time_window = 'afternoon' then p_day_start + interval '12 hours'
    when v_task.time_window = 'evening' then p_day_start + interval '18 hours'
    else p_day_start
  end;
  v_completion_window_end := case
    when v_task.time_window = 'morning' then p_day_start + interval '12 hours'
    when v_task.time_window = 'afternoon' then p_day_start + interval '18 hours'
    else p_day_start + interval '1 day'
  end;

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

  v_points := case
    when p_partial then round(v_task.base_points * 0.5)::integer
    else v_task.base_points
  end;

  if v_streak_current >= 3 then
    v_points := round(v_points * 1.5)::integer;
  elsif v_streak_current >= 2 then
    v_points := round(v_points * 1.2)::integer;
  end if;

  with due_tasks as (
    select id, time_window
    from public.tasks
    where user_id = p_user_id
      and active = 1
      and public.task_is_due_today(days_of_week, recurrence, time_window, p_day_key, p_time_window)
  )
  select count(*) into v_active_count
  from due_tasks;

  with due_tasks as (
    select id, time_window
    from public.tasks
    where user_id = p_user_id
      and active = 1
      and public.task_is_due_today(days_of_week, recurrence, time_window, p_day_key, p_time_window)
  )
  select count(distinct dt.id) into v_today_count
  from due_tasks dt
  join public.task_completions tc on tc.task_id = dt.id
  where tc.user_id = p_user_id
    and tc.completed_at >= case
      when dt.time_window = 'afternoon' then p_day_start + interval '12 hours'
      when dt.time_window = 'evening' then p_day_start + interval '18 hours'
      else p_day_start
    end
    and tc.completed_at < case
      when dt.time_window = 'morning' then p_day_start + interval '12 hours'
      when dt.time_window = 'afternoon' then p_day_start + interval '18 hours'
      else p_day_start + interval '1 day'
    end;

  if v_today_count + 1 = v_active_count and v_active_count > 0 then
    v_points := v_points + 10;
  end if;

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
    streak_before, last_completed_before, partial, forgiveness_used
  )
  values (
    gen_random_uuid()::text, p_user_id, p_task_id, p_now, v_points,
    v_streak_before, v_last_completed_before, p_partial, false
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
$$;

grant execute on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) to authenticated;
grant execute on function public.process_task_completion_atomic(text, text, boolean, timestamptz, text, text, timestamptz) to authenticated;

with expected_totals as (
  select
    u.id as user_id,
    (
      coalesce((
        select sum(greatest(coalesce(tc.points_awarded, 0), 0))::integer
        from public.task_completions tc
        where tc.user_id = u.id
      ), 0)
      +
      coalesce((
        select sum(greatest(coalesce(fa.amount, 0), 0))::integer
        from public.family_activities fa
        where fa.user_id = u.id::uuid
          and fa.type = 'SYSTEM_MESSAGE'
          and coalesce(fa.amount, 0) > 0
      ), 0)
    ) as expected_total
  from public.users u
  where u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
corrections as (
  select
    l.user_id,
    l.total_points as old_total,
    e.expected_total,
    greatest(l.total_points - e.expected_total, 0) as excess_points
  from public.levels l
  join expected_totals e on e.user_id = l.user_id
  where l.total_points > e.expected_total
)
update public.levels l
set current_level = public.level_for_points(c.expected_total),
    total_points = c.expected_total,
    spendable_balance = greatest(0, coalesce(l.spendable_balance, 0) - c.excess_points),
    updated_at = now()
from corrections c
where l.user_id = c.user_id;

notify pgrst, 'reload schema';
