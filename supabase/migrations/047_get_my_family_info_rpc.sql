-- Migration 047: Combine get_my_family_id + get_my_family_name into one RPC.
--
-- hydrate() previously called get_my_family_id() and get_my_family_name()
-- as separate round-trips, plus a fallback direct families query when name
-- was null. A single RPC eliminates two round-trips on every page load.

create or replace function public.get_my_family_info()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object('id', f.id, 'name', f.name)
  from public.families f
  join public.users u on u.family_id = f.id
  where u.auth_user_id = auth.uid()
    and u.family_id is not null
  order by u.created_at desc
  limit 1
$$;

grant execute on function public.get_my_family_info() to authenticated;
