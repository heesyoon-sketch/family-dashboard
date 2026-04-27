-- Migration 031: Harden setup-family cleanup and expose explicit pre-create RPC

create or replace function public.prepare_create_family()
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
  where auth_user_id = v_auth_id
     or id = v_auth_id::text;

  update public.families
  set owner_id = null
  where owner_id = v_auth_id
    and not exists (
      select 1
      from public.users u
      where u.family_id = families.id
        and u.auth_user_id = v_auth_id
    );
end;
$$;

grant execute on function public.prepare_create_family() to authenticated;

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

  -- If this account is still the owner of a family, transition to that family
  -- instead of violating families_owner_id_key.
  select id into v_family_id
  from public.families
  where owner_id = v_owner_id
  order by created_at desc
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  perform public.prepare_create_family();

  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation for auth user %: %', v_owner_id, sqlerrm;
  when others then
    raise exception 'setup_family failed for auth user %: %', v_owner_id, sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;
