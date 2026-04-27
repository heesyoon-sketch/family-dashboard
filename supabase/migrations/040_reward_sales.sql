-- Migration 040: Reward sale fields and DB-backed discounted redemption costs.

alter table public.rewards
  add column if not exists sale_percentage integer not null default 0,
  add column if not exists sale_name text default null;

update public.rewards
set sale_percentage = least(100, greatest(0, coalesce(sale_percentage, 0))),
    sale_name = nullif(trim(coalesce(sale_name, '')), '');

drop function if exists public.admin_insert_reward(text, int, text);
drop function if exists public.admin_update_reward(text, text, int);

create or replace function public.admin_insert_reward(
  p_title text,
  p_cost_points int,
  p_icon text,
  p_sale_percentage int default 0,
  p_sale_name text default null
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
begin
  insert into public.rewards (
    id, title, cost_points, icon, family_id, sale_percentage, sale_name
  )
  values (
    gen_random_uuid(),
    trim(p_title),
    greatest(1, p_cost_points),
    p_icon,
    v_family_id,
    v_sale_percentage,
    v_sale_name
  )
  returning * into v_reward;

  return v_reward;
end;
$$;

grant execute on function public.admin_insert_reward(text, int, text, int, text) to authenticated;

create or replace function public.admin_update_reward(
  p_reward_id text,
  p_title text,
  p_cost_points int,
  p_sale_percentage int default 0,
  p_sale_name text default null
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
begin
  update public.rewards
  set title = trim(p_title),
      cost_points = greatest(1, p_cost_points),
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

grant execute on function public.admin_update_reward(text, text, int, int, text) to authenticated;

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
  where id = p_reward_id::uuid
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
  v_sale_percentage := least(100, greatest(0, coalesce(v_reward.sale_percentage, 0)));
  v_current_cost := greatest(
    floor(v_base_cost - (v_base_cost * v_sale_percentage / 100.0))::integer,
    0
  );

  if coalesce(v_level.spendable_balance, 0) < v_current_cost then
    raise exception '잔액이 부족합니다';
  end if;

  v_new_balance := greatest(coalesce(v_level.spendable_balance, 0) - v_current_cost, 0);

  update public.levels
  set spendable_balance = v_new_balance,
      updated_at = p_now
  where user_id = p_user_id;

  insert into public.reward_redemptions (id, user_id, reward_id, redeemed_at, cost_charged)
  values (gen_random_uuid(), p_user_id::uuid, p_reward_id::uuid, p_now, v_current_cost);

  return jsonb_build_object(
    'spendableBalance', v_new_balance,
    'costCharged', v_current_cost,
    'baseCost', v_base_cost,
    'salePercentage', v_sale_percentage,
    'saleName', v_reward.sale_name,
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;
