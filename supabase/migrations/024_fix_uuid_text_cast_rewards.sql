-- Fix "operator does not exist: uuid = text" errors in reward RPCs.
-- rewards.id, reward_redemptions.reward_id, and reward_redemptions.user_id
-- are uuid columns; the RPCs pass text parameters and need explicit ::uuid casts.

-- ── redeem_reward_atomic ──────────────────────────────────────────────────────
create or replace function public.redeem_reward_atomic(
  p_user_id   text,
  p_reward_id text,
  p_day_key   text,
  p_now       timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id  uuid := public.get_my_family_id();
  v_level      public.levels;
  v_reward     public.rewards;
  v_base_cost  integer;
  v_curr_cost  integer;
  v_new_bal    integer;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user_id          -- users.id is text
      and family_id = v_family_id  -- users.family_id is uuid
  ) then
    raise exception 'User % not found', p_user_id;
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id::uuid    -- rewards.id is uuid
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
  where user_id = p_user_id       -- levels.user_id is text
  for update;

  v_base_cost := greatest(coalesce(v_reward.cost_points, 0), 0);
  v_curr_cost := public.reward_effective_cost(v_base_cost, p_day_key);

  if coalesce(v_level.spendable_balance, 0) < v_curr_cost then
    raise exception '잔액이 부족합니다';
  end if;

  v_new_bal := greatest(coalesce(v_level.spendable_balance, 0) - v_curr_cost, 0);

  update public.levels
  set spendable_balance = v_new_bal,
      updated_at = p_now
  where user_id = p_user_id;

  insert into public.reward_redemptions (id, user_id, reward_id, redeemed_at, cost_charged)
  values (
    gen_random_uuid(),          -- reward_redemptions.id is uuid
    p_user_id::uuid,            -- reward_redemptions.user_id is uuid
    p_reward_id::uuid,          -- reward_redemptions.reward_id is uuid
    p_now,
    v_curr_cost
  );

  return jsonb_build_object(
    'spendableBalance', v_new_bal,
    'costCharged',      v_curr_cost,
    'baseCost',         v_base_cost,
    'rewardId',         p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;

-- ── admin_update_reward ───────────────────────────────────────────────────────
create or replace function public.admin_update_reward(p_reward_id text, p_title text, p_cost_points int)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_reward    public.rewards;
begin
  update public.rewards
  set title       = trim(p_title),
      cost_points = greatest(1, p_cost_points)
  where id          = p_reward_id::uuid   -- rewards.id is uuid
    and family_id   = v_family_id
  returning * into v_reward;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  return v_reward;
end;
$$;

grant execute on function public.admin_update_reward(text, text, int) to authenticated;

-- ── admin_delete_reward ───────────────────────────────────────────────────────
create or replace function public.admin_delete_reward(p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id   uuid := public.assert_parent_admin();
  v_deleted_cnt integer;
begin
  delete from public.rewards
  where id        = p_reward_id::uuid   -- rewards.id is uuid
    and family_id = v_family_id;

  get diagnostics v_deleted_cnt = row_count;
  if v_deleted_cnt = 0 then
    raise exception 'Reward not found';
  end if;
end;
$$;

grant execute on function public.admin_delete_reward(text) to authenticated;
