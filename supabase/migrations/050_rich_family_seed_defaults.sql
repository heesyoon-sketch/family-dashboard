-- Migration 050: Rich onboarding seed data for newly-created families.
--
-- New families should land on a useful dashboard immediately: four starter
-- members, a broad task set, meaningful store rewards, initial points, and a
-- welcome mailbox message.

alter table public.family_activities
  drop constraint if exists family_activities_type_check;

alter table public.family_activities
  add constraint family_activities_type_check
  check (type in ('GIFT_RECEIVED', 'GIFT_SENT', 'REWARD_PURCHASED', 'TASK_COMPLETED', 'SYSTEM_MESSAGE'));

alter table public.rewards
  add column if not exists sale_price integer default null;

drop policy if exists "families_owner_delete" on public.families;
create policy "families_owner_delete" on public.families
  for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.ensure_default_tasks_for_member(
  p_member_id text,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_all_days text[] := array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  v_weekdays text[] := array['MON', 'TUE', 'WED', 'THU', 'FRI'];
  v_weekend text[] := array['SAT', 'SUN'];
begin
  select role into v_role
  from public.users
  where id = p_member_id
    and family_id = p_family_id;

  if v_role is null then
    return;
  end if;

  if exists (
    select 1
    from public.tasks
    where user_id = p_member_id
      and family_id = p_family_id
  ) then
    return;
  end if;

  insert into public.tasks (
    id, user_id, title, icon, difficulty, base_points, recurrence,
    days_of_week, time_window, active, sort_order, family_id
  )
  values
    (gen_random_uuid()::text, p_member_id, '🛏️ 아침 이불 개기', 'bed', 'EASY', 10, 'daily', v_all_days, 'morning', 1, 1, p_family_id),
    (gen_random_uuid()::text, p_member_id, '🎒 하교/하원 후 가방 정리', 'backpack', 'MEDIUM', 15, 'weekdays', v_weekdays, 'evening', 1, 2, p_family_id),
    (gen_random_uuid()::text, p_member_id, '🧹 주말 내 방 청소', 'brush-cleaning', 'HARD', 30, 'weekend', v_weekend, null, 1, 3, p_family_id),
    (gen_random_uuid()::text, p_member_id, '💖 가족 안아주며 칭찬하기', 'heart-handshake', 'HARD', 50, 'daily', v_all_days, null, 1, 4, p_family_id);
end;
$$;

create or replace function public.ensure_default_tasks_for_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.users;
begin
  for v_member in
    select *
    from public.users
    where family_id = p_family_id
    order by display_order, created_at
  loop
    perform public.ensure_default_tasks_for_member(v_member.id, v_member.family_id);
  end loop;
end;
$$;

create or replace function public.seed_default_family_data(
  p_family_id         uuid default null,
  p_admin_name        text default null,
  p_admin_avatar_url  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id       uuid := auth.uid();
  v_auth_email    text;
  v_family_id     uuid := p_family_id;
  v_user_count    integer;
  v_reward_count  integer;
  v_admin_name    text := nullif(trim(coalesce(p_admin_name, '')), '');
  v_admin_avatar  text := nullif(trim(coalesce(p_admin_avatar_url, '')), '');
  v_welcome_msg   text := '🎉 윤씨네 대시보드 템플릿에 오신 것을 환영합니다!';
  v_gift_msg      text := '우리아들, 앱 시작을 축하해! 첫 선물이야 🎁';
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

  if v_family_id is null then
    select id into v_family_id
    from public.families
    where owner_id = v_auth_id
    order by created_at desc
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'No family found. Pass p_family_id from setup_family() result.';
  end if;

  if not exists (
    select 1
    from public.families
    where id = v_family_id
      and owner_id = v_auth_id
  ) then
    raise exception 'Caller is not the owner of family %', v_family_id;
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values
      (gen_random_uuid()::text, coalesce(v_admin_name, 'Dad'), 'PARENT', 'dark_minimal',
       v_family_id, v_auth_id, v_admin_avatar, v_auth_email, 'google', 0, now()),
      (gen_random_uuid()::text, 'Mom',     'PARENT', 'warm_minimal',
       v_family_id, null, null, null, 'device', 1, now()),
      (gen_random_uuid()::text, 'Child 1', 'CHILD',  'robot_neon',
       v_family_id, null, null, null, 'device', 2, now()),
      (gen_random_uuid()::text, 'Child 2', 'CHILD',  'pastel_cute',
       v_family_id, null, null, null, 'device', 3, now());
  elsif not exists (
    select 1
    from public.users
    where family_id = v_family_id
      and auth_user_id = v_auth_id
  ) then
    update public.users
    set auth_user_id = v_auth_id,
        role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        avatar_url   = coalesce(v_admin_avatar, avatar_url),
        login_method = 'google'
    where id = (
      select id
      from public.users
      where family_id = v_family_id
      order by case when role = 'PARENT' then 0 else 1 end, display_order, created_at asc
      limit 1
    );
  else
    update public.users
    set role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        avatar_url   = coalesce(v_admin_avatar, avatar_url),
        login_method = 'google'
    where family_id = v_family_id
      and auth_user_id = v_auth_id;
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Mom' or (role = 'PARENT' and display_order = 1))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Mom', 'PARENT', 'warm_minimal',
      v_family_id, null, null, null, 'device', 1, now()
    );
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Child 1' or (role = 'CHILD' and display_order = 2))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Child 1', 'CHILD', 'robot_neon',
      v_family_id, null, null, null, 'device', 2, now()
    );
  end if;

  if not exists (
    select 1 from public.users
    where family_id = v_family_id
      and (name = 'Child 2' or (role = 'CHILD' and display_order = 3))
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email,
      login_method, display_order, created_at
    ) values (
      gen_random_uuid()::text, 'Child 2', 'CHILD', 'pastel_cute',
      v_family_id, null, null, null, 'device', 3, now()
    );
  end if;

  perform public.ensure_default_tasks_for_family(v_family_id);

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  select u.id, 1, 100, 100, now()
  from public.users u
  where u.family_id = v_family_id
  on conflict (user_id) do nothing;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (
      id, title, icon, cost_points, family_id,
      sale_enabled, sale_percentage, sale_price, sale_name
    )
    values
      (gen_random_uuid(), '🍿 오늘 간식 1개 선택권', 'ice-cream', 100, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎮 30분 영상 보기 / 게임 하기', 'gamepad-2', 400, v_family_id, true, 38, 250, '튜토리얼 세일'),
      (gen_random_uuid(), '👑 YESaturday (하루 종일 예스맨 되기)', 'smile-plus', 5000, v_family_id, false, 0, null, null);
  end if;

  insert into public.family_activities (
    family_id, user_id, type, amount, message, created_at
  )
  select
    v_family_id,
    u.id::uuid,
    'SYSTEM_MESSAGE',
    100,
    v_welcome_msg,
    now()
  from public.users u
  where u.family_id = v_family_id
    and u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = u.id::uuid
        and a.type = 'SYSTEM_MESSAGE'
        and a.message = v_welcome_msg
    );

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  select
    v_family_id,
    child_one.id::uuid,
    'GIFT_RECEIVED',
    10,
    mom.name,
    v_gift_msg,
    now() + interval '1 second'
  from public.users mom
  join public.users child_one on child_one.family_id = v_family_id
  where mom.family_id = v_family_id
    and mom.name = 'Mom'
    and child_one.name = 'Child 1'
    and mom.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and child_one.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = child_one.id::uuid
        and a.type = 'GIFT_RECEIVED'
        and a.message = v_gift_msg
    )
  limit 1;

  insert into public.family_activities (
    family_id, user_id, type, amount, related_user_name, message, created_at
  )
  select
    v_family_id,
    mom.id::uuid,
    'GIFT_SENT',
    10,
    child_one.name,
    v_gift_msg,
    now() + interval '1 second'
  from public.users mom
  join public.users child_one on child_one.family_id = v_family_id
  where mom.family_id = v_family_id
    and mom.name = 'Mom'
    and child_one.name = 'Child 1'
    and mom.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and child_one.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and not exists (
      select 1
      from public.family_activities a
      where a.family_id = v_family_id
        and a.user_id = mom.id::uuid
        and a.type = 'GIFT_SENT'
        and a.message = v_gift_msg
    )
  limit 1;
end;
$$;

grant execute on function public.seed_default_family_data(uuid, text, text) to authenticated;

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
  v_sale_price := case
    when coalesce(v_reward.sale_enabled, false) and v_reward.sale_price is not null
      then least(v_base_cost, greatest(0, v_reward.sale_price))
    else null
  end;
  v_current_cost := coalesce(
    v_sale_price,
    greatest(floor(v_base_cost - (v_base_cost * v_sale_percentage / 100.0))::integer, 0)
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
    'salePrice', v_sale_price,
    'saleName', v_reward.sale_name,
    'rewardId', p_reward_id
  );
end;
$$;

grant execute on function public.redeem_reward_atomic(text, text, text, timestamptz) to authenticated;

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
  v_sale_price integer;
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
    'user1Id', p_user1_id::text,
    'user1Balance', v_user1_balance,
    'user2Id', p_user2_id::text,
    'user2Balance', v_user2_balance
  );
end;
$$;

grant execute on function public.purchase_reward_joint(uuid, uuid, int, uuid, int) to authenticated;

create or replace function public.setup_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id  uuid := auth.uid();
  v_family_id uuid;
  v_name      text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;
  if v_name is null then
    raise exception 'Family name is required';
  end if;

  update public.users
  set auth_user_id = null,
      login_method = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_owner_id;

  update public.families
  set owner_id = null
  where owner_id = v_owner_id;

  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  perform public.seed_default_family_data(v_family_id, null, null);

  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation: %', sqlerrm;
  when others then
    raise exception 'setup_family failed: %', sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;
