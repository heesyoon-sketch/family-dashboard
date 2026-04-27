-- Migration 030: Fix Join -> Leave -> Create loop

create or replace function public.leave_current_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  update public.users
  set auth_user_id = null,
      login_method = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_auth_id;

  update public.families
  set owner_id = null
  where owner_id = v_auth_id;
end;
$$;

grant execute on function public.leave_current_family() to authenticated;

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

  -- A Google account can create a fresh family after leaving another one.
  -- Remove stale member links and owner pointers first to avoid old-family
  -- resolution and users_auth_user_id_key conflicts.
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

  return v_family_id;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;

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
      (gen_random_uuid()::text, '아이스크림', 'ice-cream', 50, v_family_id),
      (gen_random_uuid()::text, '게임 30분', 'gamepad-2', 100, v_family_id),
      (gen_random_uuid()::text, '영화 보기', 'tv', 200, v_family_id);
  end if;
end;
$$;

grant execute on function public.seed_default_family_data(text, text) to authenticated;
