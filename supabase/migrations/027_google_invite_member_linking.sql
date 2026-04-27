-- Migration 027: Google invite linking + parent family read policies
--
-- Lets invited Google users bind their auth account to an existing member row.
-- The RPC first tries an email match, then supports explicit member selection,
-- then preserves the legacy name-based /join fallback.

alter table public.users
  add column if not exists email text;

create index if not exists users_family_email_idx
  on public.users (family_id, lower(email))
  where email is not null;

drop function if exists public.join_family_by_code(text, text, text);

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

drop policy if exists "tasks_family_select" on public.tasks;
create policy "tasks_family_select" on public.tasks
  for select using (
    family_id = public.get_my_family_id()
    and (
      public.is_my_family_parent()
      or exists (
        select 1
        from public.users u
        where u.id = tasks.user_id
          and u.auth_user_id = auth.uid()
          and u.family_id = public.get_my_family_id()
      )
    )
  );

drop policy if exists "task_completions_family_select" on public.task_completions;
create policy "task_completions_family_select" on public.task_completions
  for select using (
    exists (
      select 1
      from public.users owner
      where owner.id = task_completions.user_id
        and owner.family_id = public.get_my_family_id()
        and (
          public.is_my_family_parent()
          or owner.auth_user_id = auth.uid()
        )
    )
  );
