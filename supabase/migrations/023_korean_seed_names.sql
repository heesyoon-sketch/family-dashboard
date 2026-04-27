-- Update seed_default_family_data to use Korean placeholder names
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
  v_family_id uuid := public.get_my_family_id();
  v_user_count integer;
  v_task_count integer;
  v_reward_count integer;
  v_admin_name text := nullif(trim(coalesce(p_admin_name, '')), '');
  v_admin_avatar text := nullif(trim(coalesce(p_admin_avatar_url, '')), '');
  v_member public.users;
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, login_method, created_at
    )
    values
      (
        gen_random_uuid()::text,
        coalesce(v_admin_name, '아빠'),
        'PARENT',
        'dark_minimal',
        v_family_id,
        v_auth_id,
        v_admin_avatar,
        'google',
        now()
      ),
      (gen_random_uuid()::text, '엄마',  'PARENT', 'warm_minimal', v_family_id, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이1', 'CHILD',  'robot_neon',   v_family_id, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이2', 'CHILD',  'pastel_cute',  v_family_id, null, null, 'device', now());
  elsif not exists (
    select 1 from public.users where family_id = v_family_id and auth_user_id = v_auth_id
  ) then
    update public.users
    set auth_user_id = v_auth_id,
        avatar_url = coalesce(v_admin_avatar, avatar_url),
        login_method = 'google'
    where id = (
      select id
      from public.users
      where family_id = v_family_id and role = 'PARENT'
      order by created_at asc
      limit 1
    );
  end if;

  -- Seed tasks and rewards only if none exist (unchanged logic)
  select count(*) into v_task_count
  from public.tasks
  where family_id = v_family_id;

  if v_task_count = 0 then
    for v_member in
      select * from public.users where family_id = v_family_id
    loop
      insert into public.tasks (
        id, user_id, title, icon, difficulty, base_points, recurrence,
        days_of_week, active, sort_order, family_id
      )
      values
        (gen_random_uuid()::text, v_member.id, '양치하기',   'sparkles',  'EASY',   10, 'daily', null, true, 1, v_family_id),
        (gen_random_uuid()::text, v_member.id, '독서 30분',  'book-open', 'MEDIUM', 20, 'daily', null, true, 2, v_family_id),
        (gen_random_uuid()::text, v_member.id, '운동하기',   'dumbbell',  'HARD',   30, 'daily', null, true, 3, v_family_id);
    end loop;
  end if;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (id, title, icon, cost, family_id)
    values
      (gen_random_uuid()::text, '아이스크림',   'ice-cream',   50,  v_family_id),
      (gen_random_uuid()::text, '게임 30분',    'gamepad-2',   100, v_family_id),
      (gen_random_uuid()::text, '영화 보기',    'tv',          200, v_family_id);
  end if;
end;
$$;

grant execute on function public.seed_default_family_data(text, text) to authenticated;
