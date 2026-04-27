-- Migration 041: Allow admins to update icons for existing rewards.

drop function if exists public.admin_update_reward(text, text, int, int, text);

create or replace function public.admin_update_reward(
  p_reward_id text,
  p_title text,
  p_cost_points int,
  p_sale_percentage int default 0,
  p_sale_name text default null,
  p_icon text default null
)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
  v_sale_percentage integer := least(100, greatest(0, coalesce(p_sale_percentage, 0)));
  v_sale_name text := nullif(trim(coalesce(p_sale_name, '')), '');
  v_icon text := nullif(trim(coalesce(p_icon, '')), '');
begin
  update public.rewards
  set title = trim(p_title),
      cost_points = greatest(1, p_cost_points),
      icon = coalesce(v_icon, icon),
      sale_percentage = v_sale_percentage,
      sale_name = v_sale_name
  where id = p_reward_id::uuid
    and family_id = v_family_id
  returning * into v_reward;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  return v_reward;
end;
$$;

grant execute on function public.admin_update_reward(text, text, int, int, text, text) to authenticated;
