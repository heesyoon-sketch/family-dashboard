-- Migration 068: Prevent accidental double reward purchases.
--
-- A fast double-click can send two redeem RPCs before React has time to disable
-- the checkout button. Serialize purchase attempts per reward/member set and
-- reject a second identical purchase within a few seconds. Also silently repairs
-- historical accidental duplicate solo purchases by returning the duplicate
-- charge and hiding the duplicate generated activity/history row.

with duplicate_solo_redemptions as (
  select later.id, later.user_id::text as user_id, later.reward_id, later.cost_charged, later.redeemed_at
  from public.reward_redemptions later
  where coalesce(later.is_joint_purchase, false) = false
    and later.refunded_at is null
    and exists (
      select 1
      from public.reward_redemptions earlier
      where coalesce(earlier.is_joint_purchase, false) = false
        and earlier.refunded_at is null
        and earlier.id <> later.id
        and earlier.user_id = later.user_id
        and earlier.reward_id = later.reward_id
        and coalesce(earlier.cost_charged, 0) = coalesce(later.cost_charged, 0)
        and earlier.redeemed_at < later.redeemed_at
        and later.redeemed_at - earlier.redeemed_at <= interval '2 seconds'
    )
),
refund_totals as (
  select user_id, sum(greatest(coalesce(cost_charged, 0), 0))::integer as amount
  from duplicate_solo_redemptions
  group by user_id
)
update public.levels l
set spendable_balance = coalesce(l.spendable_balance, 0) + rt.amount,
    updated_at = now()
from refund_totals rt
where l.user_id = rt.user_id;

update public.reward_redemptions rr
set refunded_at = coalesce(rr.refunded_at, now()),
    refund_reason = 'duplicate_auto_refund'
where rr.id in (
  select later.id
  from public.reward_redemptions later
  where coalesce(later.is_joint_purchase, false) = false
    and later.refunded_at is null
    and exists (
      select 1
      from public.reward_redemptions earlier
      where coalesce(earlier.is_joint_purchase, false) = false
        and earlier.refunded_at is null
        and earlier.id <> later.id
        and earlier.user_id = later.user_id
        and earlier.reward_id = later.reward_id
        and coalesce(earlier.cost_charged, 0) = coalesce(later.cost_charged, 0)
        and earlier.redeemed_at < later.redeemed_at
        and later.redeemed_at - earlier.redeemed_at <= interval '2 seconds'
    )
);

delete from public.family_activities fa
using public.reward_redemptions rr
left join public.rewards r on r.id = rr.reward_id
where rr.refund_reason = 'duplicate_auto_refund'
  and fa.type = 'REWARD_PURCHASED'
  and fa.user_id = rr.user_id::uuid
  and fa.amount = greatest(coalesce(rr.cost_charged, 0), 0)
  and coalesce(fa.message, '') = coalesce(r.title, '(deleted reward)')
  and abs(extract(epoch from (fa.created_at - rr.redeemed_at))) < 2;

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
    where rr.user_id = p_user_id::uuid
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
  values (gen_random_uuid(), p_user_id::uuid, p_reward_id::uuid, v_now, v_current_cost);

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

create or replace function public.purchase_reward_joint(
  p_reward_id text,
  p_user1_id text,
  p_user1_amount int,
  p_user2_id text,
  p_user2_amount int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_reward public.rewards;
  v_user1_level public.levels;
  v_user2_level public.levels;
  v_base_cost integer;
  v_sale_percentage integer;
  v_sale_price integer;
  v_current_cost integer;
  v_user1_balance integer;
  v_user2_balance integer;
  v_redemption_id uuid := gen_random_uuid();
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_pair_key text;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if p_reward_id !~* v_uuid_pattern
     or p_user1_id !~* v_uuid_pattern
     or p_user2_id !~* v_uuid_pattern then
    raise exception 'Joint purchase requires UUID reward and member IDs';
  end if;

  if p_user1_id = p_user2_id then
    raise exception 'Joint purchase requires two different users';
  end if;

  v_pair_key := least(p_user1_id, p_user2_id) || ':' || greatest(p_user1_id, p_user2_id);
  perform pg_advisory_xact_lock(hashtextextended(
    'joint-redeem:' || v_family_id::text || ':' || p_reward_id || ':' || v_pair_key,
    0
  ));

  if coalesce(p_user1_amount, 0) < 0 or coalesce(p_user2_amount, 0) < 0 then
    raise exception 'Payment amounts cannot be negative';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user1_id and family_id = v_family_id and deleted_at is null
  ) then
    raise exception 'User 1 not found';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user2_id and family_id = v_family_id and deleted_at is null
  ) then
    raise exception 'User 2 not found';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id::uuid
    and family_id = v_family_id
  for update;

  if not found then
    raise exception 'Reward not found';
  end if;

  if coalesce(v_reward.is_hidden, false) then
    raise exception 'Reward is not available';
  end if;

  if coalesce(v_reward.is_sold_out, false) then
    raise exception '품절된 보상입니다';
  end if;

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

  if coalesce(p_user1_amount, 0) + coalesce(p_user2_amount, 0) <> v_current_cost then
    raise exception 'Split amounts must equal reward cost';
  end if;

  if exists (
    select 1
    from public.reward_redemptions rr
    where rr.reward_id = p_reward_id::uuid
      and coalesce(rr.is_joint_purchase, false) = true
      and rr.refunded_at is null
      and rr.redeemed_at >= now() - interval '3 seconds'
      and (
        (rr.joint_user1_id = p_user1_id::uuid and rr.joint_user2_id = p_user2_id::uuid)
        or
        (rr.joint_user1_id = p_user2_id::uuid and rr.joint_user2_id = p_user1_id::uuid)
      )
  ) then
    raise exception '이미 처리된 구매입니다. 잠시 후 다시 시도해주세요.';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (p_user1_id, 1, 0, 0, now()),
    (p_user2_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_user1_level
  from public.levels
  where user_id = p_user1_id
  for update;

  select * into v_user2_level
  from public.levels
  where user_id = p_user2_id
  for update;

  if coalesce(v_user1_level.spendable_balance, 0) < p_user1_amount then
    raise exception '첫 번째 사용자의 잔액이 부족합니다';
  end if;

  if coalesce(v_user2_level.spendable_balance, 0) < p_user2_amount then
    raise exception '두 번째 사용자의 잔액이 부족합니다';
  end if;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_user1_amount,
      updated_at = now()
  where user_id = p_user1_id
  returning spendable_balance into v_user1_balance;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_user2_amount,
      updated_at = now()
  where user_id = p_user2_id
  returning spendable_balance into v_user2_balance;

  insert into public.reward_redemptions (
    id,
    user_id,
    reward_id,
    redeemed_at,
    cost_charged,
    is_joint_purchase,
    joint_user1_id,
    joint_user1_amount,
    joint_user2_id,
    joint_user2_amount
  )
  values (
    v_redemption_id,
    p_user1_id::uuid,
    p_reward_id::uuid,
    now(),
    v_current_cost,
    true,
    p_user1_id::uuid,
    p_user1_amount,
    p_user2_id::uuid,
    p_user2_amount
  );

  return jsonb_build_object(
    'redemptionId', v_redemption_id::text,
    'rewardId', p_reward_id,
    'costCharged', v_current_cost,
    'user1Id', p_user1_id,
    'user1Balance', v_user1_balance,
    'user2Id', p_user2_id,
    'user2Balance', v_user2_balance
  );
end;
$$;

grant execute on function public.purchase_reward_joint(text, text, int, text, int) to authenticated;

create or replace function public.admin_list_reward_redemptions(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_limit integer := least(200, greatest(1, coalesce(p_limit, 50)));
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  into v_result
  from (
    select
      rr.id::text as id,
      rr.user_id::text as user_id,
      u.name as user_name,
      rr.reward_id::text as reward_id,
      coalesce(r.title, '(deleted reward)') as reward_title,
      coalesce(r.icon, 'gift') as reward_icon,
      rr.cost_charged,
      rr.redeemed_at,
      rr.refunded_at,
      rr.refunded_by::text as refunded_by,
      rr.refund_reason,
      coalesce(rr.is_joint_purchase, false) as is_joint_purchase,
      rr.joint_user1_id::text as joint_user1_id,
      u1.name as joint_user1_name,
      rr.joint_user1_amount,
      rr.joint_user2_id::text as joint_user2_id,
      u2.name as joint_user2_name,
      rr.joint_user2_amount
    from public.reward_redemptions rr
    join public.users u on u.id = rr.user_id::text
    left join public.rewards r on r.id = rr.reward_id
    left join public.users u1 on u1.id = rr.joint_user1_id::text
    left join public.users u2 on u2.id = rr.joint_user2_id::text
    where u.family_id = v_family_id
      and coalesce(rr.refund_reason, '') <> 'duplicate_auto_refund'
    order by rr.redeemed_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

grant execute on function public.admin_list_reward_redemptions(int) to authenticated;

notify pgrst, 'reload schema';
