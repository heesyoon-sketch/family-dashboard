-- Make anonymous/device members resolve their family reliably after /join.

create or replace function public.get_my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select u.family_id
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.family_id is not null
      order by u.created_at asc
      limit 1
    ),
    (
      select u.family_id
      from public.users u
      where u.id = auth.uid()::text
        and u.family_id is not null
      order by u.created_at asc
      limit 1
    ),
    (
      select f.id
      from public.families f
      where f.owner_id = auth.uid()
      limit 1
    )
  );
$$;

create or replace function public.get_family_id_for_member(p_member_id text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select u.family_id
  from public.users u
  where u.id = p_member_id
    and u.auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_family_id_for_member(text) to authenticated;
