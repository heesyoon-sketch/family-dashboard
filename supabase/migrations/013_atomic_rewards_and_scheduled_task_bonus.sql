-- Keep reward redemption and scheduled task completion math atomic.
-- This migration intentionally adds new RPC signatures so existing installed
-- functions remain untouched until the app calls the stricter versions below.

alter table public.levels
  add column if not exists spendable_balance integer not null default 0;

alter table public.task_completions
  add column if not exists streak_before integer,
  add column if not exists last_completed_before timestamptz;

alter table public.tasks
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_completed_at timestamptz;

alter table public.rewards enable row level security;

grant select, update on table public.rewards to authenticated;

drop policy if exists "rewards_parent_update" on public.rewards;
create policy "rewards_parent_update" on public.rewards
  for update
  to authenticated
  using (
    family_id = public.get_my_family_id()
    and public.is_my_family_parent()
  )
  with check (
    family_id = public.get_my_family_id()
    and public.is_my_family_parent()
  );

drop policy if exists "rewards_family_select" on public.rewards;
create policy "rewards_family_select" on public.rewards
  for select
  to authenticated
  using (
    family_id = public.get_my_family_id()
  );

create or replace function public.level_for_points(p_points integer)
returns integer
language sql
immutable
as $$
  select case
    when p_points < 600 then 1
    when p_points < 1500 then 2
    when p_points < 3000 then 3
    when p_points < 5000 then 4
    when p_points < 8000 then 5
    when p_points < 12000 then 6
    when p_points < 18000 then 7
    when p_points < 25000 then 8
    when p_points < 40000 then 9
    else 10
  end;
$$;

create or replace function public.reward_effective_cost(
  p_base_cost integer,
  p_day_key text
)
returns integer
language sql
immutable
as $$
  select case
    when p_day_key in ('SAT', 'SUN') then greatest(1, floor(greatest(p_base_cost, 0) * 0.7)::integer)
    else greatest(p_base_cost, 0)
  end;
$$;

create or replace function public.task_is_due_today(
  p_days_of_week text[],
  p_recurrence text,
  p_time_window text,
  p_day_key text,
  p_current_window text
)
returns boolean
language sql
immutable
as $$
  select (
    case
      when coalesce(array_length(p_days_of_week, 1), 0) > 0 then p_day_key = any(p_days_of_week)
      when p_recurrence = 'weekdays' then p_day_key in ('MON', 'TUE', 'WED', 'THU', 'FRI')
      when p_recurrence = 'weekend' then p_day_key in ('SAT', 'SUN')
      else true
    end
  )
  and (
    p_time_window is null
    or p_time_window not in ('morning', 'evening')
    or p_time_window = p_current_window
  );
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
    when v_task.time_window = 'evening' then p_day_start + interval '12 hours'
    else p_day_start
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
    and completed_at <= p_now
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
    when v_gap = 0 then v_streak_before
    when v_gap = 1 then v_streak_before + 1
    else 1
  end;

  v_points := case
    when p_partial then round(v_task.base_points * 0.5)::integer
    else v_task.base_points
  end;

  if v_streak_current >= 7 then
    v_points := round(v_points * 2.0)::integer;
  elsif v_streak_current >= 3 then
    v_points := round(v_points * 1.5)::integer;
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
      when dt.time_window = 'evening' then p_day_start + interval '12 hours'
      else p_day_start
    end
    and tc.completed_at <= p_now;

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
  v_points_to_deduct integer;
  v_restored_streak integer;
  v_restored_last_completed timestamptz;
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
    when v_task.time_window = 'evening' then p_day_start + interval '12 hours'
    else p_day_start
  end;

  select * into v_completion
  from public.task_completions
  where user_id = p_user_id
    and task_id = p_task_id
    and completed_at >= v_completion_window_start
    and completed_at <= p_now
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
  v_restored_last_completed := v_completion.last_completed_before;
  v_new_total := greatest(coalesce(v_level.total_points, 0) - v_points_to_deduct, 0);
  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_points_to_deduct, 0);
  v_new_level := public.level_for_points(v_new_total);

  delete from public.task_completions
  where id = v_completion.id;

  update public.tasks
  set streak_count = v_restored_streak,
      last_completed_at = v_restored_last_completed
  where id = p_task_id;

  if v_streak.id is not null then
    update public.streaks
    set current = v_restored_streak,
        last_completed_at = v_restored_last_completed
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
    'taskLastCompletedAt', v_restored_last_completed
  );
end;
$$;

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
  v_current_cost integer;
  v_new_balance integer;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_user_id
      and family_id = v_family_id
  ) then
    raise exception 'User % not found', p_user_id;
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
    and family_id = v_family_id
  for update;

  if not found then
    raise exception 'Reward % not found', p_reward_id;
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  v_base_cost := greatest(coalesce(v_reward.cost_points, 0), 0);
  v_current_cost := public.reward_effective_cost(v_base_cost, p_day_key);

  if coalesce(v_level.spendable_balance, 0) < v_current_cost then
    raise exception '잔액이 부족합니다';
  end if;

  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_current_cost, 0);

  update public.levels
  set spendable_balance = v_new_balance,
      updated_at = p_now
  where user_id = p_user_id;

  insert into public.reward_redemptions (id, user_id, reward_id, redeemed_at)
  values (gen_random_uuid()::text, p_user_id, p_reward_id, p_now);

  return jsonb_build_object(
    'spendableBalance', v_new_balance,
    'costCharged', v_current_cost,
    'baseCost', v_base_cost,
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.reward_effective_cost(integer, text) to authenticated;
grant execute on function public.task_is_due_today(text[], text, text, text, text) to authenticated;
grant execute on function public.process_task_completion_atomic(text, text, boolean, timestamptz, text, text, timestamptz) to authenticated;
grant execute on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) to authenticated;
grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;
