-- Migration 039: Reliable family name lookup for headers.
--
-- Frontend direct selects from public.families can return no rows when RLS
-- policies or deployment order are out of sync. This RPC resolves the caller's
-- verified family through the existing SECURITY DEFINER get_my_family_id().

create or replace function public.get_my_family_name()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select f.name
  from public.families f
  where f.id = public.get_my_family_id()
  limit 1
$$;

grant execute on function public.get_my_family_name() to authenticated;
