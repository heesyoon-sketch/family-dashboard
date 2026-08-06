-- Migration 103: Let each family member choose one persistent store goal.
-- Goals live in family_settings so they inherit family deletion, realtime,
-- and family-scoped reads. Writes go through this validated RPC because
-- ordinary family_settings changes remain parent-admin only.

create or replace function public.set_member_reward_goal(
  p_user_id text,
  p_reward_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_key text := 'reward_goal:' || coalesce(p_user_id, '');
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Parents may manage goals from the shared family dashboard. A linked
  -- non-parent account may only change its own profile's goal.
  if not exists (
    select 1 from public.users u
    where u.id = p_user_id
      and u.family_id = v_family_id
      and u.deleted_at is null
      and (u.auth_user_id = auth.uid() or public.is_my_family_parent())
  ) then
    raise exception 'Not allowed to change this member goal';
  end if;

  if p_reward_id is null or btrim(p_reward_id) = '' then
    delete from public.family_settings
    where family_id = v_family_id and key = v_key;
    return jsonb_build_object('userId', p_user_id, 'rewardId', null);
  end if;

  if not exists (
    select 1 from public.rewards
    where id = p_reward_id
      and family_id = v_family_id
      and deleted_at is null
      and not coalesce(is_hidden, false)
  ) then
    raise exception 'Reward is not available in your family';
  end if;

  insert into public.family_settings (key, value, updated_at, family_id)
  values (
    v_key,
    jsonb_build_object('rewardId', p_reward_id)::text,
    now(),
    v_family_id
  )
  on conflict (key, family_id) do update
    set value = excluded.value,
        updated_at = excluded.updated_at;

  return jsonb_build_object('userId', p_user_id, 'rewardId', p_reward_id);
end;
$$;

revoke all on function public.set_member_reward_goal(text, text) from public, anon;
grant execute on function public.set_member_reward_goal(text, text) to authenticated;
