-- Store the exact points charged for each reward redemption.
-- This preserves purchase history when reward prices change or weekend
-- discounts apply.

alter table public.reward_redemptions
  add column if not exists cost_charged integer not null default 0;

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

  insert into public.reward_redemptions (
    id, user_id, reward_id, redeemed_at, cost_charged
  )
  values (
    gen_random_uuid()::text, p_user_id, p_reward_id, p_now, v_current_cost
  );

  return jsonb_build_object(
    'spendableBalance', v_new_balance,
    'costCharged', v_current_cost,
    'baseCost', v_base_cost,
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;
