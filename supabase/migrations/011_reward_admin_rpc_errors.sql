-- Make reward admin RPCs fail loudly when the target row is not in the caller's family.

create or replace function public.admin_update_reward(p_reward_id text, p_title text, p_cost_points int)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
begin
  update public.rewards
  set title = trim(p_title),
      cost_points = greatest(1, p_cost_points)
  where id = p_reward_id
    and family_id = v_family_id
  returning * into v_reward;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  return v_reward;
end;
$$;

create or replace function public.admin_delete_reward(p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_deleted_count integer;
begin
  delete from public.rewards
  where id = p_reward_id
    and family_id = v_family_id;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then
    raise exception 'Reward not found';
  end if;
end;
$$;

grant execute on function public.admin_update_reward(text, text, int) to authenticated;
grant execute on function public.admin_delete_reward(text) to authenticated;
