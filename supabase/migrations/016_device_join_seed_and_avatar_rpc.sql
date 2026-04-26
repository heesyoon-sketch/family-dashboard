-- Device-based family join, default onboarding seed data, and avatar RPCs.

alter table public.users
  add column if not exists login_method text not null default 'device';

update public.users
set login_method = 'google'
where auth_user_id is not null
  and login_method <> 'google';

update public.users
set login_method = 'device'
where auth_user_id is null
  and login_method <> 'device';

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
      and u.login_method = 'google'
  );
$$;

create or replace function public.join_family_by_code(
  p_invite_code text,
  p_member_name text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
  v_family_id uuid;
  v_existing public.users;
  v_member public.users;
  v_role text := upper(trim(coalesce(p_role, 'CHILD')));
  v_name text := nullif(trim(coalesce(p_member_name, '')), '');
  v_count integer;
  v_themes text[] := array['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'];
  v_theme text;
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null then
    raise exception 'Member name is required';
  end if;

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
      raise exception 'This device is already linked to another family';
    end if;

    return jsonb_build_object(
      'familyId', v_existing.family_id,
      'memberId', v_existing.id
    );
  end if;

  select count(*) into v_count
  from public.users
  where family_id = v_family_id;
  v_theme := v_themes[(v_count % array_length(v_themes, 1)) + 1];

  insert into public.users (
    id, name, role, theme, family_id, auth_user_id, login_method, created_at
  )
  values (
    gen_random_uuid()::text,
    v_name,
    v_role,
    v_theme,
    v_family_id,
    v_auth_id,
    'device',
    now()
  )
  returning * into v_member;

  return jsonb_build_object(
    'familyId', v_member.family_id,
    'memberId', v_member.id
  );
end;
$$;

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
        coalesce(v_admin_name, 'Dad'),
        'PARENT',
        'dark_minimal',
        v_family_id,
        v_auth_id,
        v_admin_avatar,
        'google',
        now()
      ),
      (gen_random_uuid()::text, 'Mom', 'PARENT', 'warm_minimal', v_family_id, null, null, 'device', now()),
      (gen_random_uuid()::text, 'Child 1', 'CHILD', 'robot_neon', v_family_id, null, null, 'device', now()),
      (gen_random_uuid()::text, 'Child 2', 'CHILD', 'pastel_cute', v_family_id, null, null, 'device', now());
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
        (
          gen_random_uuid()::text,
          v_member.id,
          'Brush teeth',
          'sparkles',
          'EASY',
          10,
          'daily',
          array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
          1,
          0,
          v_family_id
        ),
        (
          gen_random_uuid()::text,
          v_member.id,
          'Clean room',
          'house',
          'MEDIUM',
          20,
          'daily',
          array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
          1,
          1,
          v_family_id
        ),
        (
          gen_random_uuid()::text,
          v_member.id,
          'Read a book',
          'book-open',
          'MEDIUM',
          30,
          'daily',
          array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
          1,
          2,
          v_family_id
        );
    end loop;
  end if;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (id, title, cost_points, icon, family_id)
    values
      (gen_random_uuid()::text, 'Watch 30 min TV', 300, 'monitor-play', v_family_id),
      (gen_random_uuid()::text, 'Pick dinner menu', 500, 'utensils', v_family_id),
      (gen_random_uuid()::text, 'Choose a family game', 400, 'gamepad-2', v_family_id),
      (gen_random_uuid()::text, 'Stay up 15 min later', 350, 'moon', v_family_id);
  end if;
end;
$$;

create or replace function public.update_member_avatar(
  p_member_id text,
  p_avatar_url text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_member public.users;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  update public.users
  set avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
  where id = p_member_id
    and family_id = v_family_id
    and (
      auth_user_id = auth.uid()
      or public.is_my_family_parent()
    )
  returning * into v_member;

  if v_member.id is null then
    raise exception 'Member not found or avatar update not allowed';
  end if;

  return v_member;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "member_avatars_select" on storage.objects;
create policy "member_avatars_select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'member-avatars');

drop policy if exists "member_avatars_family_insert" on storage.objects;
create policy "member_avatars_family_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and exists (
      select 1
      from public.users u
      where u.id = (storage.foldername(name))[2]
        and u.family_id = public.get_my_family_id()
        and (
          u.auth_user_id = auth.uid()
          or public.is_my_family_parent()
        )
    )
  );

drop policy if exists "member_avatars_family_update" on storage.objects;
create policy "member_avatars_family_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and exists (
      select 1
      from public.users u
      where u.id = (storage.foldername(name))[2]
        and u.family_id = public.get_my_family_id()
        and (
          u.auth_user_id = auth.uid()
          or public.is_my_family_parent()
        )
    )
  )
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

grant execute on function public.join_family_by_code(text, text, text) to authenticated;
grant execute on function public.seed_default_family_data(text, text) to authenticated;
grant execute on function public.update_member_avatar(text, text) to authenticated;
