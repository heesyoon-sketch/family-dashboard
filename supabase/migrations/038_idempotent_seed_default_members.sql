-- Migration 038: Make seed_default_family_data idempotent per default profile.
--
-- The default profiles must never duplicate when setup/seed is retried.

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
    where id = v_family_id and owner_id = v_auth_id
  ) then
    raise exception 'Caller is not the owner of family %', v_family_id;
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    ) values (
      gen_random_uuid()::text,
      coalesce(v_admin_name, '아빠'),
      'PARENT',
      'dark_minimal',
      v_family_id,
      v_auth_id,
      v_admin_avatar,
      v_auth_email,
      'google',
      now()
    );
  elsif not exists (
    select 1
    from public.users
    where family_id = v_family_id and auth_user_id = v_auth_id
  ) then
    update public.users
    set auth_user_id = v_auth_id,
        role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
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
    set role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        login_method = 'google'
    where family_id = v_family_id
      and auth_user_id = v_auth_id;
  end if;

  if not exists (
    select 1 from public.users where family_id = v_family_id and name = '엄마'
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    ) values (
      gen_random_uuid()::text, '엄마', 'PARENT', 'warm_minimal',
      v_family_id, null, null, null, 'device', now()
    );
  end if;

  if not exists (
    select 1 from public.users where family_id = v_family_id and name = '아이1'
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    ) values (
      gen_random_uuid()::text, '아이1', 'CHILD', 'robot_neon',
      v_family_id, null, null, null, 'device', now()
    );
  end if;

  if not exists (
    select 1 from public.users where family_id = v_family_id and name = '아이2'
  ) then
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    ) values (
      gen_random_uuid()::text, '아이2', 'CHILD', 'pastel_cute',
      v_family_id, null, null, null, 'device', now()
    );
  end if;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (id, title, icon, cost_points, family_id)
    values
      (gen_random_uuid(), '아이스크림', 'ice-cream', 50,  v_family_id),
      (gen_random_uuid(), '게임 30분',  'gamepad-2', 100, v_family_id),
      (gen_random_uuid(), '영화 보기',  'tv',        200, v_family_id);
  end if;
end;
$$;

grant execute on function public.seed_default_family_data(uuid, text, text) to authenticated;
