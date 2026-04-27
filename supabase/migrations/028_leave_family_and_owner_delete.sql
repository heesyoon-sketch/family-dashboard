-- Migration 028: Leave family flow and owner-safe delete cleanup

alter table public.families
  alter column owner_id drop not null;

create or replace function public.leave_current_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_member public.users;
  v_next_owner uuid;
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_member
  from public.users
  where auth_user_id = v_auth_id
  order by created_at asc
  limit 1;

  if not found then
    return;
  end if;

  update public.users
  set auth_user_id = null,
      login_method = case when login_method = 'google' then 'device' else login_method end
  where id = v_member.id;

  if exists (
    select 1
    from public.families
    where id = v_member.family_id
      and owner_id = v_auth_id
  ) then
    select u.auth_user_id into v_next_owner
    from public.users u
    where u.family_id = v_member.family_id
      and u.auth_user_id is not null
      and u.auth_user_id <> v_auth_id
      and u.role = 'PARENT'
    order by u.created_at asc
    limit 1;

    update public.families
    set owner_id = v_next_owner
    where id = v_member.family_id;
  end if;
end;
$$;

grant execute on function public.leave_current_family() to authenticated;

create or replace function public.delete_family_as_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_user_ids text[];
  v_reward_ids uuid[];
begin
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    raise exception 'Only the family creator can delete the family this way.';
  end if;

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
    delete from public.reward_redemptions
    where user_id::text = any(v_user_ids);
  end if;

  if v_reward_ids is not null then
    delete from public.reward_redemptions where reward_id = any(v_reward_ids);
  end if;

  delete from public.tasks where family_id = v_family_id;
  delete from public.rewards where family_id = v_family_id;
  delete from public.family_settings where family_id = v_family_id;
  delete from public.users where family_id = v_family_id;
  delete from public.families where id = v_family_id;
end;
$$;

grant execute on function public.delete_family_as_owner() to authenticated;

create or replace function public.join_family_by_code(
  p_invite_code text,
  p_member_name text default null,
  p_role text default 'CHILD',
  p_member_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_auth_email text;
  v_family_id uuid;
  v_existing public.users;
  v_email_member public.users;
  v_selected_member public.users;
  v_named_member public.users;
  v_member public.users;
  v_role text := upper(trim(coalesce(p_role, 'CHILD')));
  v_name text := nullif(trim(coalesce(p_member_name, '')), '');
  v_theme text;
  v_members jsonb;
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

  if v_role not in ('PARENT', 'CHILD') then
    raise exception 'Invalid role';
  end if;

  select id into v_family_id
  from public.families
  where invite_code = upper(trim(p_invite_code))
  limit 1;

  if v_family_id is null then
    raise exception 'Invalid invitation code';
  end if;

  select * into v_existing
  from public.users
  where auth_user_id = v_auth_id
  limit 1;

  if found then
    if v_existing.family_id <> v_family_id then
      raise exception 'This account is already linked to another family';
    end if;

    update public.users
    set email = coalesce(email, v_auth_email),
        role = case when v_auth_email is not null then 'PARENT' else role end,
        login_method = case when v_auth_email is not null then 'google' else login_method end
    where id = v_existing.id
    returning * into v_member;

    return jsonb_build_object(
      'familyId', v_member.family_id,
      'memberId', v_member.id,
      'linkedBy', 'existing'
    );
  end if;

  if v_auth_email is not null then
    select * into v_email_member
    from public.users
    where family_id = v_family_id
      and lower(email) = v_auth_email
    order by
      case when auth_user_id is null then 0 else 1 end,
      created_at asc
    limit 1;

    if found then
      if v_email_member.auth_user_id is not null and v_email_member.auth_user_id <> v_auth_id then
        raise exception 'This email is already linked to another account';
      end if;

      update public.users
      set auth_user_id = v_auth_id,
          email = v_auth_email,
          role = 'PARENT',
          login_method = 'google'
      where id = v_email_member.id
      returning * into v_member;

      return jsonb_build_object(
        'familyId', v_member.family_id,
        'memberId', v_member.id,
        'linkedBy', 'email'
      );
    end if;
  end if;

  if nullif(trim(coalesce(p_member_id, '')), '') is not null then
    select * into v_selected_member
    from public.users
    where family_id = v_family_id
      and id = p_member_id
    limit 1;

    if not found then
      raise exception 'Invalid member selection';
    end if;

    if v_selected_member.auth_user_id is not null and v_selected_member.auth_user_id <> v_auth_id then
      raise exception 'This member is already linked to another account';
    end if;

    update public.users
    set auth_user_id = v_auth_id,
        email = coalesce(email, v_auth_email),
        role = case when v_auth_email is not null then 'PARENT' else role end,
        login_method = case when v_auth_email is not null then 'google' else 'device' end
    where id = v_selected_member.id
    returning * into v_member;

    return jsonb_build_object(
      'familyId', v_member.family_id,
      'memberId', v_member.id,
      'linkedBy', 'selection'
    );
  end if;

  if v_name is null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'role', role,
      'avatarUrl', avatar_url,
      'claimed', auth_user_id is not null
    ) order by display_order, created_at), '[]'::jsonb)
    into v_members
    from public.users
    where family_id = v_family_id;

    return jsonb_build_object(
      'familyId', v_family_id,
      'requiresMemberSelection', true,
      'members', v_members
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_family_id::text || ':' || lower(v_name), 0));

  select * into v_named_member
  from public.users
  where family_id = v_family_id
    and lower(trim(name)) = lower(v_name)
  order by
    case when auth_user_id is null then 0 else 1 end,
    created_at asc
  limit 1;

  if found then
    if v_named_member.auth_user_id is not null and v_named_member.auth_user_id <> v_auth_id then
      raise exception 'This member is already linked to another account';
    end if;

    update public.users
    set auth_user_id = v_auth_id,
        email = coalesce(email, v_auth_email),
        role = case when v_auth_email is not null then 'PARENT' else role end,
        login_method = case when v_auth_email is not null then 'google' else 'device' end
    where id = v_named_member.id
    returning * into v_member;

    return jsonb_build_object(
      'familyId', v_member.family_id,
      'memberId', v_member.id,
      'linkedBy', 'name'
    );
  end if;

  select theme_name into v_theme
  from unnest(array['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'])
    with ordinality as theme_options(theme_name, theme_order)
  order by (
    select count(*)
    from public.users u
    where u.family_id = v_family_id
      and u.theme = theme_options.theme_name
  ), theme_order
  limit 1;

  insert into public.users (
    id, name, role, theme, family_id, auth_user_id, email, login_method, created_at
  )
  values (
    gen_random_uuid()::text,
    v_name,
    case when v_auth_email is not null then 'PARENT' else v_role end,
    v_theme,
    v_family_id,
    v_auth_id,
    v_auth_email,
    case when v_auth_email is not null then 'google' else 'device' end,
    now()
  )
  returning * into v_member;

  return jsonb_build_object(
    'familyId', v_member.family_id,
    'memberId', v_member.id,
    'linkedBy', 'created'
  );
end;
$$;

grant execute on function public.join_family_by_code(text, text, text, text) to authenticated;

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

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

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
      (
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
      ),
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
        (gen_random_uuid()::text, v_member.id, '양치하기',  'sparkles',  'EASY',   10, 'daily', null, true, 1, v_family_id),
        (gen_random_uuid()::text, v_member.id, '독서 30분', 'book-open', 'MEDIUM', 20, 'daily', null, true, 2, v_family_id),
        (gen_random_uuid()::text, v_member.id, '운동하기',  'dumbbell',  'HARD',   30, 'daily', null, true, 3, v_family_id);
    end loop;
  end if;

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
