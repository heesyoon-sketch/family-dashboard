-- Migration 042: Store admin controls, reward purchase history, and refunds.

alter table public.rewards
  add column if not exists sale_enabled boolean not null default false,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists is_sold_out boolean not null default false;

update public.rewards
set sale_enabled = true
where coalesce(sale_percentage, 0) > 0;

alter table public.reward_redemptions
  add column if not exists refunded_at timestamptz default null,
  add column if not exists refunded_by uuid default null,
  add column if not exists refund_reason text default null;

drop function if exists public.admin_update_reward(text, text, int, int, text, text);

create or replace function public.admin_update_reward(
  p_reward_id text,
  p_title text,
  p_cost_points int,
  p_sale_percentage int default 0,
  p_sale_name text default null,
  p_icon text default null,
  p_sale_enabled boolean default false,
  p_is_hidden boolean default false,
  p_is_sold_out boolean default false
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
      sale_enabled = coalesce(p_sale_enabled, false),
      sale_percentage = v_sale_percentage,
      sale_name = v_sale_name,
      is_hidden = coalesce(p_is_hidden, false),
      is_sold_out = coalesce(p_is_sold_out, false)
  where id = p_reward_id::uuid
    and family_id = v_family_id
  returning * into v_reward;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  return v_reward;
end;
$$;

grant execute on function public.admin_update_reward(text, text, int, int, text, text, boolean, boolean, boolean) to authenticated;

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

  if coalesce(v_reward.is_hidden, false) then
    raise exception 'Reward is not available';
  end if;

  if coalesce(v_reward.is_sold_out, false) then
    raise exception '품절된 보상입니다';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, p_now)
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
      rr.refund_reason
    from public.reward_redemptions rr
    join public.users u on u.id = rr.user_id::text
    left join public.rewards r on r.id = rr.reward_id
    where u.family_id = v_family_id
    order by rr.redeemed_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

grant execute on function public.admin_list_reward_redemptions(int) to authenticated;

create or replace function public.admin_refund_reward_redemption(
  p_redemption_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_redemption public.reward_redemptions;
  v_user_name text;
  v_reward_title text;
  v_new_balance integer;
begin
  select rr.* into v_redemption
  from public.reward_redemptions rr
  join public.users u on u.id = rr.user_id::text
  where rr.id = p_redemption_id::uuid
    and u.family_id = v_family_id
  for update;

  if not found then
    raise exception 'Redemption not found';
  end if;

  if v_redemption.refunded_at is not null then
    raise exception 'Already refunded';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (v_redemption.user_id::text, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + greatest(coalesce(v_redemption.cost_charged, 0), 0),
      updated_at = now()
  where user_id = v_redemption.user_id::text
  returning spendable_balance into v_new_balance;

  update public.reward_redemptions
  set refunded_at = now(),
      refunded_by = auth.uid(),
      refund_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_redemption.id;

  select u.name into v_user_name
  from public.users u
  where u.id = v_redemption.user_id::text;

  select r.title into v_reward_title
  from public.rewards r
  where r.id = v_redemption.reward_id;

  return jsonb_build_object(
    'redemptionId', v_redemption.id::text,
    'userId', v_redemption.user_id::text,
    'userName', v_user_name,
    'rewardId', v_redemption.reward_id::text,
    'rewardTitle', coalesce(v_reward_title, '(deleted reward)'),
    'refundedPoints', greatest(coalesce(v_redemption.cost_charged, 0), 0),
    'spendableBalance', v_new_balance
  );
end;
$$;

grant execute on function public.admin_refund_reward_redemption(text, text) to authenticated;
