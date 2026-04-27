-- Migration 029: Production-ready family tenant synchronization
--
-- Core invariant:
-- A signed-in auth user can read shared family data when their auth.uid() is
-- linked to any public.users row in that same family.

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.family_id = p_family_id
      and u.auth_user_id = auth.uid()
  );
$$;

grant execute on function public.is_family_member(uuid) to authenticated;

create or replace function public.get_my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select (
    select u.family_id
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.family_id is not null
    order by u.created_at asc
    limit 1
  );
$$;

grant execute on function public.get_my_family_id() to authenticated;

create or replace function public.is_my_family_parent()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.family_id = public.get_my_family_id()
      and u.role = 'PARENT'
  );
$$;

grant execute on function public.is_my_family_parent() to authenticated;

-- Family-member SELECT policies for direct-family tables.
drop policy if exists "users_family" on public.users;
drop policy if exists "users_family_select" on public.users;
create policy "users_family_select" on public.users
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "tasks_family" on public.tasks;
drop policy if exists "tasks_family_select" on public.tasks;
create policy "tasks_family_select" on public.tasks
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "rewards_family" on public.rewards;
drop policy if exists "rewards_family_select" on public.rewards;
create policy "rewards_family_select" on public.rewards
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "family_settings_family" on public.family_settings;
drop policy if exists "family_settings_family_select" on public.family_settings;
create policy "family_settings_family_select" on public.family_settings
  for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "families_member_select" on public.families;
drop policy if exists "families_owner" on public.families;
create policy "families_member_select" on public.families
  for select to authenticated
  using (public.is_family_member(id));

-- Family-member SELECT policies for user-owned child tables.
drop policy if exists "task_completions_family" on public.task_completions;
drop policy if exists "task_completions_family_select" on public.task_completions;
create policy "task_completions_family_select" on public.task_completions
  for select to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = task_completions.user_id
        and public.is_family_member(owner.family_id)
    )
  );

drop policy if exists "streaks_family" on public.streaks;
drop policy if exists "streaks_family_select" on public.streaks;
create policy "streaks_family_select" on public.streaks
  for select to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = streaks.user_id
        and public.is_family_member(owner.family_id)
    )
  );

drop policy if exists "levels_family" on public.levels;
drop policy if exists "levels_family_select" on public.levels;
create policy "levels_family_select" on public.levels
  for select to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = levels.user_id
        and public.is_family_member(owner.family_id)
    )
  );

drop policy if exists "user_badges_family" on public.user_badges;
drop policy if exists "user_badges_family_select" on public.user_badges;
create policy "user_badges_family_select" on public.user_badges
  for select to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = user_badges.user_id
        and public.is_family_member(owner.family_id)
    )
  );

drop policy if exists "reward_redemptions_family" on public.reward_redemptions;
drop policy if exists "reward_redemptions_family_select" on public.reward_redemptions;
create policy "reward_redemptions_family_select" on public.reward_redemptions
  for select to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = reward_redemptions.user_id::text
        and public.is_family_member(owner.family_id)
    )
  );

-- Keep parent-only writes explicit for direct table mutations.
drop policy if exists "users_parent_insert" on public.users;
drop policy if exists "users_parent_update" on public.users;
drop policy if exists "users_parent_delete" on public.users;
create policy "users_parent_insert" on public.users
  for insert to authenticated
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "users_parent_update" on public.users
  for update to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent())
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "users_parent_delete" on public.users
  for delete to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent());

drop policy if exists "tasks_parent_insert" on public.tasks;
drop policy if exists "tasks_parent_update" on public.tasks;
drop policy if exists "tasks_parent_delete" on public.tasks;
create policy "tasks_parent_insert" on public.tasks
  for insert to authenticated
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "tasks_parent_update" on public.tasks
  for update to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent())
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "tasks_parent_delete" on public.tasks
  for delete to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent());

drop policy if exists "rewards_parent_insert" on public.rewards;
drop policy if exists "rewards_parent_update" on public.rewards;
drop policy if exists "rewards_parent_delete" on public.rewards;
create policy "rewards_parent_insert" on public.rewards
  for insert to authenticated
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "rewards_parent_update" on public.rewards
  for update to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent())
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "rewards_parent_delete" on public.rewards
  for delete to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent());

drop policy if exists "family_settings_parent_insert" on public.family_settings;
drop policy if exists "family_settings_parent_update" on public.family_settings;
drop policy if exists "family_settings_parent_delete" on public.family_settings;
create policy "family_settings_parent_insert" on public.family_settings
  for insert to authenticated
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "family_settings_parent_update" on public.family_settings
  for update to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent())
  with check (public.is_family_member(family_id) and public.is_my_family_parent());
create policy "family_settings_parent_delete" on public.family_settings
  for delete to authenticated
  using (public.is_family_member(family_id) and public.is_my_family_parent());

create or replace function public.ensure_default_tasks_for_member(
  p_member_id text,
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
    days_of_week, active, sort_order, family_id
  )
  values
    (gen_random_uuid()::text, p_member_id, '양치하기',  'sparkles',  'EASY',   10, 'daily', array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 1, 1, p_family_id),
    (gen_random_uuid()::text, p_member_id, '독서 30분', 'book-open', 'MEDIUM', 20, 'daily', array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 1, 2, p_family_id),
    (gen_random_uuid()::text, p_member_id, '운동하기',  'dumbbell',  'HARD',   30, 'daily', array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], 1, 3, p_family_id);
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
  loop
    perform public.ensure_default_tasks_for_member(v_member.id, v_member.family_id);
  end loop;
end;
$$;

create or replace function public.ensure_default_tasks_for_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_tasks_for_member(new.id, new.family_id);
  return new;
end;
$$;

drop trigger if exists users_ensure_default_tasks on public.users;
create trigger users_ensure_default_tasks
after insert on public.users
for each row
execute function public.ensure_default_tasks_for_new_member();

-- Backfill existing family members that currently have no habits.
do $$
declare
  v_family public.families;
begin
  for v_family in select * from public.families loop
    perform public.ensure_default_tasks_for_family(v_family.id);
  end loop;
end;
$$;

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

    perform public.ensure_default_tasks_for_family(v_member.family_id);

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

      perform public.ensure_default_tasks_for_family(v_member.family_id);

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

    perform public.ensure_default_tasks_for_family(v_member.family_id);

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

    perform public.ensure_default_tasks_for_family(v_member.family_id);

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

  perform public.ensure_default_tasks_for_family(v_member.family_id);

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
