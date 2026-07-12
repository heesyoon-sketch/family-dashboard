-- Migration 098: Close the undo point-minting exploit.
--
-- process_task_undo_atomic reclaimed a completion's points with
--   v_new_balance := greatest(spendable_balance - points_to_deduct, 0);
-- The greatest(...,0) floor "forgives" any shortfall. So the loop
--   complete task (balance +N) → gift/spend the N away (balance → 0)
--   → undo (balance floored at 0, only reclaims what's left, not N)
--   → complete again …
-- exported N real points into another account on every cycle, minting points
-- that were never earned. (This is how a low-XP "bank" child accumulated a
-- huge spendable balance.)
--
-- Fix: an undo may only proceed when the member still holds at least the
-- points the completion granted. If they have already spent/gifted them,
-- reclaiming is impossible without minting, so the undo is rejected. Legit
-- undo of an accidental tap (points still present) is unaffected.

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

  v_completion_window_start := public.task_completion_window_start(p_day_start, v_task.time_window, p_time_window);
  v_completion_window_end := public.task_completion_window_end(p_day_start, v_task.time_window, p_time_window);

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

  -- Anti-minting guard: only allow the undo if the reward is still on hand.
  -- If the member has already spent or gifted these points, reclaiming them
  -- would floor the balance and forgive the shortfall, creating free points.
  if coalesce(v_level.spendable_balance, 0) < v_points_to_deduct then
    raise exception '이미 사용한 포인트라 완료를 취소할 수 없어요';
  end if;

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

revoke all on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) from public, anon;
grant execute on function public.process_task_undo_atomic(text, text, timestamptz, text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
