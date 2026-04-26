-- Reconnect /join attempts to an existing family member with the same name.
-- This prevents duplicate member rows when a device/anonymous session is reset.

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
  v_named_member public.users;
  v_member public.users;
  v_role text := upper(trim(coalesce(p_role, 'CHILD')));
  v_name text := nullif(trim(coalesce(p_member_name, '')), '');
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

  perform pg_advisory_xact_lock(hashtextextended(v_family_id::text || ':' || lower(v_name), 0));

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

  select * into v_named_member
  from public.users
  where family_id = v_family_id
    and lower(trim(name)) = lower(v_name)
  order by
    case when auth_user_id is null then 0 else 1 end,
    created_at asc
  limit 1;

  if found then
    update public.users
    set auth_user_id = v_auth_id,
        login_method = case when login_method = 'google' then login_method else 'device' end
    where id = v_named_member.id
    returning * into v_member;

    return jsonb_build_object(
      'familyId', v_member.family_id,
      'memberId', v_member.id
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

grant execute on function public.join_family_by_code(text, text, text) to authenticated;
