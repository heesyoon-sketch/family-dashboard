-- Grant EXECUTE to authenticated users for all RPCs that were created without
-- an explicit grant (migrations 002-007). Without these grants Supabase returns
-- "permission denied" and setup_family / admin functions silently fail.

-- Core family resolution + setup
grant execute on function public.get_my_family_id()                         to authenticated;
grant execute on function public.setup_family(text)                         to authenticated;
grant execute on function public.claim_owner_parent_profile()               to authenticated;

-- Admin task management (migration 005)
grant execute on function public.admin_update_user_name(text, text)         to authenticated;
grant execute on function public.admin_insert_task(text, text, text, text, int, text, text[], int, int) to authenticated;
grant execute on function public.admin_update_task(text, jsonb)             to authenticated;
grant execute on function public.admin_delete_task(text)                    to authenticated;
grant execute on function public.admin_insert_reward(text, int, text)       to authenticated;

-- Explicit INSERT policy so authenticated users can also create a family
-- via direct table access (belt-and-suspenders alongside the SECURITY DEFINER RPC).
drop policy if exists "families_insert_authenticated" on public.families;
create policy "families_insert_authenticated" on public.families
  for insert
  to authenticated
  with check (owner_id = auth.uid());
