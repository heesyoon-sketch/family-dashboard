-- Migration 032: Re-apply active RPCs with explicit UUID handling.
-- rewards.id and reward_redemptions ids are UUID columns; most frontend RPC
-- parameters arrive as text, so every comparison/insert crossing that boundary
-- must cast intentionally.

create or replace function public.admin_insert_reward(p_title text, p_cost_points int, p_icon text)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
begin
  insert into public.rewards (id, title, cost_points, icon, family_id)
  values (gen_random_uuid(), trim(p_title), greatest(1, p_cost_points), p_icon, v_family_id)
  returning * into v_reward;

  return v_reward;
end;
$$;

grant execute on function public.admin_insert_reward(text, int, text) to authenticated;

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
  v_current_cost := public.reward_effective_cost(v_base_cost, p_day_key);

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
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;

create or replace function public.admin_update_reward(p_reward_id text, p_title text, p_cost_points int)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_reward public.rewards;
begin
  update public.rewards
  set title = trim(p_title),
      cost_points = greatest(1, p_cost_points)
  where id = p_reward_id::uuid
    and family_id = v_family_id
  returning * into v_reward;

  if v_reward.id is null then
    raise exception 'Reward not found';
  end if;

  return v_reward;
end;
$$;

grant execute on function public.admin_update_reward(text, text, int) to authenticated;

create or replace function public.admin_delete_reward(p_reward_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.assert_parent_admin();
  v_deleted_count integer;
begin
  delete from public.rewards
  where id = p_reward_id::uuid
    and family_id = v_family_id;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then
    raise exception 'Reward not found';
  end if;
end;
$$;

grant execute on function public.admin_delete_reward(text) to authenticated;

create or replace function public.seed_default_family_data(
  p_admin_name text default null,
  p_admin_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_auth_email text;
  v_family_id uuid;
  v_user_count integer;
  v_reward_count integer;
  v_admin_name text := nullif(trim(coalesce(p_admin_name, '')), '');
  v_admin_avatar text := nullif(trim(coalesce(p_admin_avatar_url, '')), '');
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

  v_family_id := public.get_my_family_id();

  if v_family_id is null then
    select id into v_family_id
    from public.families
    where owner_id = v_auth_id
    order by created_at desc
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    )
    values
      (gen_random_uuid()::text, coalesce(v_admin_name, '아빠'), 'PARENT', 'dark_minimal', v_family_id, v_auth_id, v_admin_avatar, v_auth_email, 'google', now()),
      (gen_random_uuid()::text, '엄마',  'PARENT', 'warm_minimal', v_family_id, null, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이1', 'CHILD',  'robot_neon',   v_family_id, null, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이2', 'CHILD',  'pastel_cute',  v_family_id, null, null, null, 'device', now());
  elsif not exists (
    select 1 from public.users where family_id = v_family_id and auth_user_id = v_auth_id
  ) then
    update public.users
    set auth_user_id = v_auth_id,
        role = 'PARENT',
        email = coalesce(email, v_auth_email),
        login_method = 'google'
    where id = (
      select id
      from public.users
      where family_id = v_family_id
      order by case when role = 'PARENT' then 0 else 1 end, created_at asc
      limit 1
    );
  else
    update public.users
    set role = 'PARENT',
        email = coalesce(email, v_auth_email),
        login_method = 'google'
    where family_id = v_family_id
      and auth_user_id = v_auth_id;
  end if;

  perform public.ensure_default_tasks_for_family(v_family_id);

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (id, title, icon, cost_points, family_id)
    values
      (gen_random_uuid(), '아이스크림', 'ice-cream', 50, v_family_id),
      (gen_random_uuid(), '게임 30분', 'gamepad-2', 100, v_family_id),
      (gen_random_uuid(), '영화 보기', 'tv', 200, v_family_id);
  end if;
end;
$$;

grant execute on function public.seed_default_family_data(text, text) to authenticated;

create or replace function public.setup_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_family_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null then
    raise exception 'Family name is required';
  end if;

  select id into v_family_id
  from public.families
  where owner_id = v_owner_id
  order by created_at desc
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  -- PL/pgSQL functions run atomically in the caller transaction. This keeps
  -- stale auth unlinking and new family creation together.
  perform public.prepare_create_family();

  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation for auth user %: %', v_owner_id, sqlerrm;
  when others then
    raise exception 'setup_family failed for auth user %: %', v_owner_id, sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;
