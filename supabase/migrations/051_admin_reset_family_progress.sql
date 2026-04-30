-- Migration 051: Move family progress reset into a single privileged RPC.
--
-- The old client-side reset deleted several tables independently and did not
-- clear the denormalized task streak columns, so dashboards could keep showing
-- stale streaks after a reset. This function keeps the reset transactional and
-- parent-admin scoped.

create or replace function public.admin_reset_family_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_user_ids text[];
begin
  select array_agg(id) into v_user_ids
  from public.users
  where family_id = v_family_id;

  if coalesce(array_length(v_user_ids, 1), 0) = 0 then
    return;
  end if;

  delete from public.task_completions
  where user_id = any(v_user_ids);

  delete from public.streaks
  where user_id = any(v_user_ids);

  delete from public.user_badges
  where user_id = any(v_user_ids);

  delete from public.family_activities
  where family_id = v_family_id
    and type = 'TASK_COMPLETED';

  update public.tasks
  set streak_count = 0,
      last_completed_at = null
  where family_id = v_family_id;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  select id, 1, 0, 0, now()
  from public.users
  where family_id = v_family_id
  on conflict (user_id) do update
  set current_level = excluded.current_level,
      total_points = excluded.total_points,
      spendable_balance = excluded.spendable_balance,
      updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.admin_reset_family_progress() to authenticated;
