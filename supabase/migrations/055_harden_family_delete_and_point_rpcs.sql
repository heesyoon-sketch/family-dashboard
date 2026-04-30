-- Migration 055: Harden backend edge cases for family deletion and point flows.
--
-- 1. Parent-admin family deletion is now a single SECURITY DEFINER transaction
--    instead of multiple browser-side deletes.
-- 2. Point transfer and joint reward purchase RPCs accept text ids from the
--    client, validate UUID-shaped ids explicitly, then cast only at UUID audit
--    table boundaries. This avoids opaque Postgres type errors.

create or replace function public.admin_delete_current_family_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id  uuid := public.assert_parent_admin();
  v_user_ids   text[];
  v_reward_ids uuid[];
begin
  update public.users
  set auth_user_id = null,
      login_method = case when login_method = 'google' then 'device' else login_method end
  where family_id = v_family_id;

  update public.families
  set owner_id = null
  where id = v_family_id;

  select array_agg(id) into v_user_ids
  from public.users
  where family_id = v_family_id;

  select array_agg(id) into v_reward_ids
  from public.rewards
  where family_id = v_family_id;

  if v_user_ids is not null then
    delete from public.task_completions where user_id = any(v_user_ids);
    delete from public.streaks where user_id = any(v_user_ids);
    delete from public.levels where user_id = any(v_user_ids);
    delete from public.user_badges where user_id = any(v_user_ids);
    delete from public.reward_redemptions where user_id = any(v_user_ids);
  end if;

  if v_reward_ids is not null then
    delete from public.reward_redemptions where reward_id = any(v_reward_ids);
  end if;

  delete from public.family_activities where family_id = v_family_id;
  delete from public.point_transactions where family_id = v_family_id;
  delete from public.tasks where family_id = v_family_id;
  delete from public.rewards where family_id = v_family_id;
  delete from public.family_settings where family_id = v_family_id;
  delete from public.users where family_id = v_family_id;
  delete from public.families where id = v_family_id;
end;
$$;

grant execute on function public.admin_delete_current_family_data() to authenticated;

drop function if exists public.transfer_points_with_message(uuid, uuid, int, text);

create or replace function public.transfer_points_with_message(
  p_sender_id text,
  p_receiver_id text,
  p_amount int,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_sender public.levels;
  v_receiver public.levels;
  v_sender_balance integer;
  v_receiver_balance integer;
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if p_sender_id !~* v_uuid_pattern or p_receiver_id !~* v_uuid_pattern then
    raise exception 'Point gifting requires UUID member IDs';
  end if;

  if p_sender_id = p_receiver_id then
    raise exception 'Cannot gift points to the same user';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Gift amount must be positive';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_sender_id and family_id = v_family_id
  ) then
    raise exception 'Sender not found';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_receiver_id and family_id = v_family_id
  ) then
    raise exception 'Receiver not found';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (p_sender_id, 1, 0, 0, now()),
    (p_receiver_id, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_sender
  from public.levels
  where user_id = p_sender_id
  for update;

  select * into v_receiver
  from public.levels
  where user_id = p_receiver_id
  for update;

  if coalesce(v_sender.spendable_balance, 0) < p_amount then
    raise exception '잔액이 부족합니다';
  end if;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_amount,
      updated_at = now()
  where user_id = p_sender_id
  returning spendable_balance into v_sender_balance;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + p_amount,
      updated_at = now()
  where user_id = p_receiver_id
  returning spendable_balance into v_receiver_balance;

  insert into public.point_transactions (
    family_id, sender_id, receiver_id, amount, message, created_at
  )
  values (
    v_family_id, p_sender_id::uuid, p_receiver_id::uuid, p_amount, v_message, now()
  );

  return jsonb_build_object(
    'senderId', p_sender_id,
    'receiverId', p_receiver_id,
    'amount', p_amount,
    'message', v_message,
    'senderBalance', v_sender_balance,
    'receiverBalance', v_receiver_balance
  );
end;
$$;

grant execute on function public.transfer_points_with_message(text, text, int, text) to authenticated;

drop function if exists public.purchase_reward_joint(uuid, uuid, int, uuid, int);

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

  if coalesce(p_user1_amount, 0) < 0 or coalesce(p_user2_amount, 0) < 0 then
    raise exception 'Payment amounts cannot be negative';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user1_id and family_id = v_family_id
  ) then
    raise exception 'User 1 not found';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user2_id and family_id = v_family_id
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
    p_user1_id,
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

notify pgrst, 'reload schema';
