-- Fix avatar uploads from Admin page: give any family parent full access
-- to the member-avatars bucket without requiring a per-member user join.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public             = true,
    file_size_limit    = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

-- ── SELECT ────────────────────────────────────────────────────────────────
drop policy if exists "member_avatars_select" on storage.objects;
create policy "member_avatars_select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'member-avatars');

-- ── INSERT ────────────────────────────────────────────────────────────────
-- Allow any family parent to insert into their family's folder.
-- Also allow a member to insert into their own sub-folder.
drop policy if exists "member_avatars_family_insert" on storage.objects;
create policy "member_avatars_family_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and (
      public.is_my_family_parent()
      or exists (
        select 1
        from public.users u
        where u.id       = (storage.foldername(name))[2]
          and u.family_id = public.get_my_family_id()
          and u.auth_user_id = auth.uid()
      )
    )
  );

-- ── UPDATE ────────────────────────────────────────────────────────────────
drop policy if exists "member_avatars_family_update" on storage.objects;
create policy "member_avatars_family_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and (
      public.is_my_family_parent()
      or exists (
        select 1
        from public.users u
        where u.id        = (storage.foldername(name))[2]
          and u.family_id  = public.get_my_family_id()
          and u.auth_user_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

-- ── DELETE ────────────────────────────────────────────────────────────────
drop policy if exists "member_avatars_family_delete" on storage.objects;
create policy "member_avatars_family_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'member-avatars'
    and (storage.foldername(name))[1] = public.get_my_family_id()::text
    and (
      public.is_my_family_parent()
      or exists (
        select 1
        from public.users u
        where u.id        = (storage.foldername(name))[2]
          and u.family_id  = public.get_my_family_id()
          and u.auth_user_id = auth.uid()
      )
    )
  );

-- ── update_member_avatar RPC ──────────────────────────────────────────────
-- Allow a parent to update avatar_url for ANY member in their family,
-- not just the member whose auth_user_id matches.
create or replace function public.update_member_avatar(
  p_member_id  text,
  p_avatar_url text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.get_my_family_id();
  v_member    public.users;
begin
  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  if not (
    public.is_my_family_parent()
    or exists (
      select 1 from public.users
      where id = p_member_id and auth_user_id = auth.uid()
    )
  ) then
    raise exception 'Permission denied: must be a family parent or the member themselves';
  end if;

  update public.users
  set avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
  where id        = p_member_id
    and family_id = v_family_id
  returning * into v_member;

  if v_member.id is null then
    raise exception 'Member % not found in family', p_member_id;
  end if;

  return v_member;
end;
$$;

grant execute on function public.update_member_avatar(text, text) to authenticated;
