-- Migration 057: Expand starter store rewards for newly-created families.
--
-- New families now receive a fuller reward shop with prices spread across
-- quick wins, daily goals, weekly goals, and special family events.

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
      (gen_random_uuid(), '🍬 오늘 작은 간식 선택권', 'candy', 80, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🥤 좋아하는 음료 선택권', 'cup-soda', 120, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🍪 쿠키/디저트 하나', 'cookie', 180, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '📖 잠자리 책 한 권 더 읽기', 'book-open', 220, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎵 좋아하는 노래 3곡 틀기', 'music', 250, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎮 영상 보기 / 게임 하기 20분', 'gamepad-2', 300, v_family_id, true, 17, 250, '첫 주 적응 세일'),
      (gen_random_uuid(), '🍿 가족 영화 간식 담당권', 'popcorn', 400, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🧩 보드게임/퍼즐 20분', 'puzzle', 450, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎨 만들기/그림 시간 30분', 'palette', 500, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🚲 자전거/놀이터 시간 30분', 'bike', 650, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🍦 아이스크림/카페 데이트', 'ice-cream', 800, v_family_id, true, 19, 650, '이번 주 특별'),
      (gen_random_uuid(), '🍕 저녁 메뉴 후보 제안권', 'pizza', 1000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎬 가족 영화 밤 선택권', 'clapperboard', 1200, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🛍️ 작은 문구/스티커 구매', 'shopping-bag', 1500, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🧁 함께 디저트 만들기', 'cake-slice', 1800, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '📚 새 책 한 권 고르기', 'book-open', 2400, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🗺️ 주말 근교 나들이 제안권', 'map', 3000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎁 작은 장난감/굿즈 구매', 'gift', 3800, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '👑 YESaturday (하루 종일 예스맨 되기)', 'crown', 5000, v_family_id, false, 0, null, null),
      (gen_random_uuid(), '🎟️ 특별 가족 이벤트 선택권', 'ticket', 6500, v_family_id, false, 0, null, null);
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
    and u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
    and mom.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and child_one.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
