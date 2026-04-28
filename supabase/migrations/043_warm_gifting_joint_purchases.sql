-- Migration 043: Warm gifting and joint reward purchases.

create table if not exists public.point_transactions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  sender_id   uuid not null,
  receiver_id uuid not null,
  amount      integer not null check (amount > 0),
  message     text,
  created_at  timestamptz not null default now()
);

alter table public.point_transactions enable row level security;

drop policy if exists "point_transactions_family_select" on public.point_transactions;
create policy "point_transactions_family_select" on public.point_transactions
  for select to authenticated
  using (family_id = public.get_my_family_id());

alter table public.reward_redemptions
  add column if not exists is_joint_purchase boolean not null default false,
  add column if not exists joint_user1_id uuid default null,
  add column if not exists joint_user1_amount integer not null default 0,
  add column if not exists joint_user2_id uuid default null,
  add column if not exists joint_user2_amount integer not null default 0;

create or replace function public.transfer_points_with_message(
  p_sender_id uuid,
  p_receiver_id uuid,
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
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if p_sender_id = p_receiver_id then
    raise exception 'Cannot gift points to the same user';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Gift amount must be positive';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_sender_id::text and family_id = v_family_id
  ) then
    raise exception 'Sender not found';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_receiver_id::text and family_id = v_family_id
  ) then
    raise exception 'Receiver not found';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (p_sender_id::text, 1, 0, 0, now()),
    (p_receiver_id::text, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_sender
  from public.levels
  where user_id = p_sender_id::text
  for update;

  select * into v_receiver
  from public.levels
  where user_id = p_receiver_id::text
  for update;

  if coalesce(v_sender.spendable_balance, 0) < p_amount then
    raise exception '잔액이 부족합니다';
  end if;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_amount,
      updated_at = now()
  where user_id = p_sender_id::text
  returning spendable_balance into v_sender_balance;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + p_amount,
      updated_at = now()
  where user_id = p_receiver_id::text
  returning spendable_balance into v_receiver_balance;

  insert into public.point_transactions (
    family_id, sender_id, receiver_id, amount, message, created_at
  )
  values (
    v_family_id, p_sender_id, p_receiver_id, p_amount, v_message, now()
  );

  return jsonb_build_object(
    'senderId', p_sender_id::text,
    'receiverId', p_receiver_id::text,
    'amount', p_amount,
    'message', v_message,
    'senderBalance', v_sender_balance,
    'receiverBalance', v_receiver_balance
  );
end;
$$;

grant execute on function public.transfer_points_with_message(uuid, uuid, int, text) to authenticated;

create or replace function public.purchase_reward_joint(
  p_reward_id uuid,
  p_user1_id uuid,
  p_user1_amount int,
  p_user2_id uuid,
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
  v_current_cost integer;
  v_user1_balance integer;
  v_user2_balance integer;
  v_redemption_id uuid := gen_random_uuid();
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if p_user1_id = p_user2_id then
    raise exception 'Joint purchase requires two different users';
  end if;

  if coalesce(p_user1_amount, 0) < 0 or coalesce(p_user2_amount, 0) < 0 then
    raise exception 'Payment amounts cannot be negative';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user1_id::text and family_id = v_family_id
  ) then
    raise exception 'User 1 not found';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_user2_id::text and family_id = v_family_id
  ) then
    raise exception 'User 2 not found';
  end if;

  select * into v_reward
  from public.rewards
  where id = p_reward_id
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
  v_current_cost := greatest(
    floor(v_base_cost - (v_base_cost * v_sale_percentage / 100.0))::integer,
    0
  );

  if coalesce(p_user1_amount, 0) + coalesce(p_user2_amount, 0) <> v_current_cost then
    raise exception 'Split amounts must equal reward cost';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (p_user1_id::text, 1, 0, 0, now()),
    (p_user2_id::text, 1, 0, 0, now())
  on conflict (user_id) do nothing;

  select * into v_user1_level
  from public.levels
  where user_id = p_user1_id::text
  for update;

  select * into v_user2_level
  from public.levels
  where user_id = p_user2_id::text
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
  where user_id = p_user1_id::text
  returning spendable_balance into v_user1_balance;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) - p_user2_amount,
      updated_at = now()
  where user_id = p_user2_id::text
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
    p_reward_id,
    now(),
    v_current_cost,
    true,
    p_user1_id,
    p_user1_amount,
    p_user2_id,
    p_user2_amount
  );

  return jsonb_build_object(
    'redemptionId', v_redemption_id::text,
    'rewardId', p_reward_id::text,
    'costCharged', v_current_cost,
    'baseCost', v_base_cost,
    'salePercentage', v_sale_percentage,
    'user1Id', p_user1_id::text,
    'user1Amount', p_user1_amount,
    'user1Balance', v_user1_balance,
    'user2Id', p_user2_id::text,
    'user2Amount', p_user2_amount,
    'user2Balance', v_user2_balance
  );
end;
$$;

grant execute on function public.purchase_reward_joint(uuid, uuid, int, uuid, int) to authenticated;
