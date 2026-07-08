-- Migration 096: Trade points for real-world cash purchases ($1 = 100pt).
--
-- Kids can pay for a real store item with points: the tagged dollar price is
-- rounded to the nearest dollar ($4.99 → $5 → 500pt, $3.49 → $3 → 300pt,
-- minimum $1) and that many points are deducted from spendable_balance.
-- total_points (XP/level) are never touched, matching reward redemptions.

create table if not exists public.cash_trades (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  user_id        uuid not null,
  price_cents    integer not null check (price_cents > 0),
  points_charged integer not null check (points_charged > 0),
  request_id     uuid not null unique,
  created_at     timestamptz not null default now()
);

alter table public.cash_trades enable row level security;

drop policy if exists "cash_trades_family_select" on public.cash_trades;
create policy "cash_trades_family_select" on public.cash_trades
  for select to authenticated
  using (family_id = public.get_my_family_id());

create or replace function public.redeem_cash_trade_atomic(
  p_user_id text,
  p_price_cents integer,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_level public.levels;
  v_existing public.cash_trades;
  v_inserted_id uuid;
  v_points integer;
  v_new_balance integer;
  v_price_label text;
  v_now timestamptz := now();
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_family_id is null or auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_request_id is null then
    raise exception 'Trade request ID is required';
  end if;
  if p_user_id !~* v_uuid_pattern then
    raise exception 'Cash trade requires a UUID member ID';
  end if;
  if coalesce(p_price_cents, 0) < 1 or p_price_cents > 99999 then
    raise exception 'Price must be between $0.01 and $999.99';
  end if;

  if not exists (
    select 1
    from public.users
    where id = p_user_id
      and family_id = v_family_id
      and deleted_at is null
  ) then
    raise exception 'User % not found', p_user_id;
  end if;

  -- Nearest dollar, halves round up; anything under $1.50 still costs $1.
  v_points := greatest(round(p_price_cents / 100.0)::integer, 1) * 100;
  v_price_label := '$' || (p_price_cents / 100)::text || '.' || lpad((p_price_cents % 100)::text, 2, '0');

  perform pg_advisory_xact_lock(hashtextextended(
    'cash_trade:' || v_family_id::text || ':' || p_user_id,
    0
  ));

  -- Insert the receipt before changing the balance. A concurrent retry blocks
  -- on the unique key, then returns the committed result without paying twice.
  insert into public.cash_trades (
    family_id, user_id, price_cents, points_charged, request_id, created_at
  )
  values (v_family_id, p_user_id::uuid, p_price_cents, v_points, p_request_id, v_now)
  on conflict (request_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_existing
    from public.cash_trades
    where request_id = p_request_id;

    if v_existing.family_id <> v_family_id
      or v_existing.user_id <> p_user_id::uuid
      or v_existing.price_cents <> p_price_cents
    then
      raise exception 'Trade request ID was reused with different data';
    end if;

    select * into v_level from public.levels where user_id = p_user_id;
    return jsonb_build_object(
      'duplicate', true,
      'spendableBalance', coalesce(v_level.spendable_balance, 0),
      'pointsCharged', v_existing.points_charged,
      'priceCents', v_existing.price_cents
    );
  end if;

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values (p_user_id, 1, 0, 0, v_now)
  on conflict (user_id) do nothing;

  select * into v_level
  from public.levels
  where user_id = p_user_id
  for update;

  if coalesce(v_level.spendable_balance, 0) < v_points then
    raise exception '잔액이 부족합니다';
  end if;

  v_new_balance := coalesce(v_level.spendable_balance, 0) - v_points;

  update public.levels
  set spendable_balance = v_new_balance,
      updated_at = v_now
  where user_id = p_user_id;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  values (v_family_id, p_user_id::uuid, 'REWARD_PURCHASED', v_points, '💵 ' || v_price_label, v_now);

  return jsonb_build_object(
    'duplicate', false,
    'spendableBalance', v_new_balance,
    'pointsCharged', v_points,
    'priceCents', p_price_cents
  );
end;
$$;

revoke all on function public.redeem_cash_trade_atomic(text, integer, uuid) from public, anon;
grant execute on function public.redeem_cash_trade_atomic(text, integer, uuid) to authenticated;

notify pgrst, 'reload schema';
