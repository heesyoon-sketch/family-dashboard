-- Migration 097: Admin visibility and refunds for cash trades.
--
-- Cash trades (096) recorded receipts but parents had no way to see or undo
-- them: the admin purchase history reads reward_redemptions only. Give
-- cash_trades the same operational state (pending / processed / refunded)
-- and admin RPCs shaped like the reward redemption ones, so the admin panel
-- can merge both into a single history list.

alter table public.cash_trades
  add column if not exists processed_at timestamptz default null,
  add column if not exists processed_by uuid default null,
  add column if not exists refunded_at timestamptz default null,
  add column if not exists refunded_by uuid default null,
  add column if not exists refund_reason text default null;

create or replace function public.cash_trade_price_label(p_price_cents integer)
returns text
language sql
immutable
as $$
  select '$' || (p_price_cents / 100)::text || '.' || lpad((p_price_cents % 100)::text, 2, '0');
$$;

create or replace function public.admin_list_cash_trades(p_limit int default 50)
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
      ct.id::text as id,
      ct.user_id::text as user_id,
      u.name as user_name,
      ct.id::text as reward_id,
      '💵 ' || public.cash_trade_price_label(ct.price_cents) as reward_title,
      'dollar-sign' as reward_icon,
      ct.points_charged as cost_charged,
      ct.price_cents,
      ct.created_at as redeemed_at,
      ct.processed_at,
      ct.processed_by::text as processed_by,
      processor.name as processed_by_name,
      ct.refunded_at,
      ct.refunded_by::text as refunded_by,
      ct.refund_reason,
      false as is_joint_purchase,
      null::text as joint_user1_id,
      null::text as joint_user1_name,
      0 as joint_user1_amount,
      null::text as joint_user2_id,
      null::text as joint_user2_name,
      0 as joint_user2_amount,
      true as is_cash_trade
    from public.cash_trades ct
    join public.users u on u.id = ct.user_id::text
    left join public.users processor
      on processor.auth_user_id = ct.processed_by
     and processor.family_id = v_family_id
    where ct.family_id = v_family_id
    order by ct.created_at desc
    limit v_limit
  ) x;

  return v_result;
end;
$$;

create or replace function public.admin_refund_cash_trade(
  p_trade_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_trade public.cash_trades;
  v_user_name text;
  v_new_balance integer;
  v_refunded_at timestamptz := now();
begin
  select ct.* into v_trade
  from public.cash_trades ct
  where ct.id = p_trade_id::uuid
    and ct.family_id = v_family_id
  for update;

  if not found then
    raise exception 'Cash trade not found';
  end if;

  if v_trade.refunded_at is not null then
    raise exception 'Already refunded';
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (v_trade.user_id::text, 1, 0, 0, v_refunded_at)
  on conflict (user_id) do nothing;

  update public.levels
  set spendable_balance = coalesce(spendable_balance, 0) + greatest(coalesce(v_trade.points_charged, 0), 0),
      updated_at = v_refunded_at
  where user_id = v_trade.user_id::text
  returning spendable_balance into v_new_balance;

  update public.cash_trades
  set refunded_at = v_refunded_at,
      refunded_by = auth.uid(),
      refund_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = v_trade.id;

  select u.name into v_user_name
  from public.users u
  where u.id = v_trade.user_id::text;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  values (
    v_family_id,
    v_trade.user_id,
    'REWARD_REFUNDED',
    greatest(coalesce(v_trade.points_charged, 0), 0),
    '💵 ' || public.cash_trade_price_label(v_trade.price_cents),
    v_refunded_at
  );

  return jsonb_build_object(
    'tradeId', v_trade.id::text,
    'userId', v_trade.user_id::text,
    'userName', v_user_name,
    'refundedPoints', greatest(coalesce(v_trade.points_charged, 0), 0),
    'spendableBalance', v_new_balance
  );
end;
$$;

create or replace function public.admin_mark_cash_trade_processed(
  p_trade_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_trade public.cash_trades;
  v_processed_at timestamptz := now();
  v_processor_name text;
begin
  select ct.* into v_trade
  from public.cash_trades ct
  where ct.id = p_trade_id::uuid
    and ct.family_id = v_family_id
  for update;

  if not found then
    raise exception 'Cash trade not found';
  end if;

  if v_trade.refunded_at is not null then
    raise exception 'Already refunded';
  end if;

  if v_trade.processed_at is null then
    update public.cash_trades
    set processed_at = v_processed_at,
        processed_by = auth.uid()
    where id = v_trade.id
    returning * into v_trade;
  end if;

  select u.name into v_processor_name
  from public.users u
  where u.auth_user_id = v_trade.processed_by
    and u.family_id = v_family_id
  order by u.display_order nulls last, u.created_at
  limit 1;

  return jsonb_build_object(
    'tradeId', v_trade.id::text,
    'processedAt', v_trade.processed_at,
    'processedByName', v_processor_name
  );
end;
$$;

revoke all on function public.cash_trade_price_label(integer) from public, anon;
revoke all on function public.admin_list_cash_trades(int) from public, anon;
revoke all on function public.admin_refund_cash_trade(text, text) from public, anon;
revoke all on function public.admin_mark_cash_trade_processed(text) from public, anon;
grant execute on function public.admin_list_cash_trades(int) to authenticated;
grant execute on function public.admin_refund_cash_trade(text, text) to authenticated;
grant execute on function public.admin_mark_cash_trade_processed(text) to authenticated;

notify pgrst, 'reload schema';
